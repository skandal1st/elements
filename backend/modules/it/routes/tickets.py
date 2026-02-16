"""Роуты /it/tickets — заявки (тикеты)."""

import json
from datetime import datetime, timezone
import time
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db, require_it_roles
from backend.modules.it.models import (
    Consumable,
    ConsumableIssue,
    EmailSenderEmployeeMap,
    Notification,
    Ticket,
    TicketConsumable,
    TicketHistory,
)
from backend.modules.it.schemas.ticket import (
    TicketAssignUser,
    TicketAssignExecutor,
    TicketConsumableOut,
    TicketCreate,
    TicketHistoryOut,
    TicketOut,
    TicketUpdate,
)
from backend.modules.it.services.ticket_history import log_ticket_changes
from backend.modules.knowledge_core.models import (
    KnowledgeArticle,
    KnowledgeTicketSuggestionLog,
)
from backend.modules.knowledge_core.services.embeddings import create_embedding
from backend.modules.knowledge_core.services.qdrant import QdrantClient
from backend.modules.knowledge_core.services.llm import chat_completion

UTC = timezone.utc

router = APIRouter(prefix="/tickets", tags=["tickets"])

class TicketReplyEmailRequest(BaseModel):
    message: str


def _user_it_role(user: User) -> str:
    if user.is_superuser:
        return "admin"
    return user.get_role("it") or "employee"


def _get_settings_map(db: Session, keys: list[str]) -> dict[str, str]:
    rows = (
        db.query(SystemSettings.setting_key, SystemSettings.setting_value)
        .filter(SystemSettings.setting_key.in_(keys))
        .all()
    )
    return {k: (v or "") for k, v in rows}


def _bool(val: str | None, default: bool = False) -> bool:
    if val is None:
        return default
    v = str(val).strip().lower()
    if v in ("true", "1", "yes", "y", "on"):
        return True
    if v in ("false", "0", "no", "n", "off"):
        return False
    return default


def _send_new_ticket_notifications(
    db: Session,
    ticket,
    assignee,
    channels: list[str],
    recipients_mode: str,
    custom_users_json: str | None,
    source: str,
):
    """Создать in-app уведомления о новой заявке для нужных получателей."""
    import json as _json

    if "in_app" not in channels:
        return

    # Определяем получателей
    recipient_ids: list[UUID] = []

    if recipients_mode == "assigned_only":
        if assignee:
            recipient_ids = [assignee.id]
    elif recipients_mode == "custom" and custom_users_json:
        try:
            recipient_ids = [UUID(uid) for uid in _json.loads(custom_users_json)]
        except Exception:
            pass
    else:
        # all_it — все IT-специалисты
        users = db.query(User).filter(User.is_active == True).all()
        for u in users:
            roles = u.roles or {}
            it_role = roles.get("it", "")
            if it_role in ("admin", "it_specialist") or u.is_superuser:
                recipient_ids.append(u.id)

    # Не уведомляем создателя
    recipient_ids = [uid for uid in recipient_ids if uid != ticket.creator_id]

    for uid in recipient_ids:
        notif = Notification(
            user_id=uid,
            title="Новая заявка",
            message=f'Создана заявка: "{ticket.title}"',
            type="info",
            related_type="ticket",
            related_id=str(ticket.id),
        )
        db.add(notif)
    if recipient_ids:
        db.commit()


class TicketSuggestionsResponse(BaseModel):
    raw_response: str
    suggestions: list[dict]
    article_ids: list[str]


@router.post(
    "/{ticket_id}/suggestions",
    response_model=TicketSuggestionsResponse,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee", "auditor"]))],
)
async def suggest_solutions_for_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TicketSuggestionsResponse:
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    role = _user_it_role(user)
    # employee — только свои заявки; auditor — все
    if role == "employee" and t.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")

    cfg = _get_settings_map(
        db,
        [
            "llm_suggestions_enabled",
            "openrouter_api_key",
            "openrouter_base_url",
            "openrouter_model",
            "openrouter_embedding_model",
            "qdrant_url",
            "qdrant_collection",
        ],
    )

    enabled_raw = cfg.get("llm_suggestions_enabled") or None
    enabled = (
        _bool(enabled_raw, False)
        if enabled_raw is not None
        else bool(settings.llm_suggestions_enabled)
    )
    if not enabled:
        raise HTTPException(status_code=400, detail="LLM_SUGGESTIONS_ENABLED отключен")

    api_key = cfg.get("openrouter_api_key") or settings.openrouter_api_key
    base_url = cfg.get("openrouter_base_url") or settings.openrouter_base_url
    chat_model = cfg.get("openrouter_model") or settings.openrouter_model
    emb_model = (
        cfg.get("openrouter_embedding_model") or settings.openrouter_embedding_model
    )
    qdrant_url = cfg.get("qdrant_url") or settings.qdrant_url
    qdrant_collection = cfg.get("qdrant_collection") or settings.qdrant_collection
    if not qdrant_url:
        raise HTTPException(status_code=400, detail="Qdrant не настроен (qdrant_url пустой)")

    query_text = f"Ticket title: {t.title}\n\nTicket description:\n{t.description}".strip()
    log = KnowledgeTicketSuggestionLog(
        ticket_id=t.id,
        query_text=query_text,
        embedding_model=emb_model,
        chat_model=chat_model,
        qdrant_collection=qdrant_collection,
        found_article_ids=[],
        response_text=None,
        success=False,
        duration_ms=None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    t0 = time.time()
    try:
        vec, _meta = await create_embedding(
            query_text, api_key=api_key, base_url=base_url, model=emb_model
        )
        qc = QdrantClient(url=qdrant_url, collection=qdrant_collection)
        # коллекция должна существовать — если нет, объясним
        await qc.ensure_collection(vector_size=len(vec))

        equipment_id = str(t.equipment_id) if t.equipment_id else None
        results = await qc.search(vector=vec, limit=5, equipment_id=equipment_id)

        article_ids: list[UUID] = []
        for r in results:
            pid = r.get("id") or (r.get("payload") or {}).get("article_id")
            try:
                article_ids.append(UUID(str(pid)))
            except Exception:
                continue
        # уникальные, с сохранением порядка
        seen = set()
        uniq_ids: list[UUID] = []
        for x in article_ids:
            if x in seen:
                continue
            seen.add(x)
            uniq_ids.append(x)

        log.found_article_ids = uniq_ids
        db.commit()

        if not uniq_ids:
            log.response_text = "[]"
            log.success = True
            log.duration_ms = int((time.time() - t0) * 1000)
            db.commit()
            return TicketSuggestionsResponse(raw_response="[]", suggestions=[], article_ids=[])

        articles = (
            db.query(KnowledgeArticle)
            .filter(KnowledgeArticle.id.in_(uniq_ids), KnowledgeArticle.status == "normalized")
            .all()
        )
        art_map = {a.id: a for a in articles}

        # контекст: только normalized_content, без Credentials
        ctx_parts: list[str] = []
        for aid in uniq_ids:
            a = art_map.get(aid)
            if not a:
                continue
            content = (a.normalized_content or "").strip()
            if len(content) > 1800:
                content = content[:1800] + "\n...(truncated)"
            ctx_parts.append(
                f"ARTICLE_ID: {a.id}\nTITLE: {a.title}\nCONFIDENCE_SCORE: {a.confidence_score}\nCONTENT:\n{content}"
            )
        ctx = "\n\n---\n\n".join(ctx_parts)

        system_prompt = (
            "Ты IT-ассистент. Твоя задача — предложить варианты решения тикета, "
            "используя ТОЛЬКО предоставленные статьи базы знаний. "
            "Не добавляй фактов, которых нет в статьях или тикете.\n\n"
            "Верни ответ строго в JSON формате:\n"
            "{\n"
            '  \"suggestions\": [\n'
            "    {\n"
            '      \"article_id\": \"<uuid>\",\n'
            '      \"title\": \"<string>\",\n'
            '      \"why_relevant\": \"<string>\",\n'
            '      \"solution_steps\": [\"<step>\", \"<step>\"]\n'
            "    }\n"
            "  ]\n"
            "}\n"
        )
        user_prompt = (
            f"Тикет:\n{query_text}\n\n"
            f"Статьи (контекст):\n{ctx}\n\n"
            "Сформируй до 5 вариантов."
        )

        raw, meta = await chat_completion(
            api_key=api_key,
            base_url=base_url,
            model=chat_model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.2,
        )

        suggestions: list[dict] = []
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and isinstance(parsed.get("suggestions"), list):
                suggestions = parsed["suggestions"]
        except Exception:
            # fallback: без парсинга
            suggestions = []

        log.response_text = raw
        log.success = True
        log.duration_ms = meta.get("duration_ms")
        db.commit()

        return TicketSuggestionsResponse(
            raw_response=raw,
            suggestions=suggestions,
            article_ids=[str(x) for x in uniq_ids],
        )
    except Exception as e:
        log.response_text = str(e)
        log.success = False
        log.duration_ms = int((time.time() - t0) * 1000)
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))

@router.get(
    "/",
    response_model=List[TicketOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee", "auditor"]))],
)
def list_tickets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    hide_closed: bool = Query(False),
    my_tickets: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> List[Ticket]:
    role = _user_it_role(user)
    from backend.modules.hr.models.employee import Employee

    q = db.query(Ticket, Employee.full_name).outerjoin(Employee, Ticket.employee_id == Employee.id)
    # employee видит только свои заявки; auditor — все (как admin/it_specialist)
    if role == "employee":
        q = q.filter(Ticket.creator_id == user.id)
    elif my_tickets:
        from sqlalchemy import or_
        q = q.filter(or_(Ticket.creator_id == user.id, Ticket.assignee_id == user.id))
    if hide_closed:
        q = q.filter(Ticket.status != "closed")
    if status:
        q = q.filter(Ticket.status == status)
    if priority:
        q = q.filter(Ticket.priority == priority)
    if category:
        q = q.filter(Ticket.category == category)
    if source:
        q = q.filter(Ticket.source == source)
    if search and search.strip():
        s = f"%{search.strip()}%"
        from sqlalchemy import or_

        q = q.filter(or_(Ticket.title.ilike(s), Ticket.description.ilike(s)))
    q = q.order_by(Ticket.created_at.desc())
    offset = (page - 1) * page_size
    rows = q.offset(offset).limit(page_size).all()
    out: List[dict] = []
    for t, employee_name in rows:
        d = TicketOut.model_validate(t).model_dump()
        d["employee_name"] = employee_name
        out.append(d)
    return out


@router.get(
    "/{ticket_id}",
    response_model=TicketOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee", "auditor"]))],
)
def get_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Ticket:
    from backend.modules.hr.models.employee import Employee

    row = (
        db.query(Ticket, Employee.full_name)
        .outerjoin(Employee, Ticket.employee_id == Employee.id)
        .filter(Ticket.id == ticket_id)
        .first()
    )
    t = row[0] if row else None
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    role = _user_it_role(user)
    # employee видит только свои; auditor — все
    if role == "employee" and t.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    employee_name = row[1] if row else None
    d = TicketOut.model_validate(t).model_dump()
    d["employee_name"] = employee_name
    return d


class TicketAssignEmployee(BaseModel):
    employee_id: int


@router.get(
    "/{ticket_id}/history",
    response_model=List[TicketHistoryOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee", "auditor"]))],
)
def get_ticket_history(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[dict]:
    """Получить историю изменений тикета."""
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    role = _user_it_role(user)
    if role == "employee" and t.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")

    # Получаем историю с JOIN на пользователя
    history = (
        db.query(TicketHistory, User.full_name)
        .outerjoin(User, TicketHistory.changed_by_id == User.id)
        .filter(TicketHistory.ticket_id == ticket_id)
        .order_by(TicketHistory.created_at.desc())
        .all()
    )

    result = []
    for h, user_name in history:
        item = {
            "id": h.id,
            "ticket_id": h.ticket_id,
            "changed_by_id": h.changed_by_id,
            "field": h.field,
            "old_value": h.old_value,
            "new_value": h.new_value,
            "created_at": h.created_at,
            "changed_by_name": user_name,
        }
        result.append(item)

    return result


@router.post(
    "/",
    response_model=TicketOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
async def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Ticket:
    from backend.modules.hr.models.employee import Employee

    data = payload.model_dump()
    data["creator_id"] = user.id

    # Устанавливаем source по умолчанию если не указан
    if not data.get("source"):
        data["source"] = "web"

    # Обработка for_employee_id
    for_employee_id = data.pop("for_employee_id", None)

    if for_employee_id:
        # IT создает заявку для сотрудника
        employee = db.query(Employee).filter(Employee.id == for_employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Сотрудник не найден")

        data["employee_id"] = employee.id

        # Автозаполнение room_id, если не указан или пустая строка
        room_id_value = data.get("room_id")
        if (not room_id_value or room_id_value == "") and employee.room_id:
            data["room_id"] = employee.room_id
    else:
        # Обычный пользователь создает для себя
        employee = db.query(Employee).filter(Employee.user_id == user.id).first()
        if employee:
            data["employee_id"] = employee.id
            room_id_value = data.get("room_id")
            if (not room_id_value or room_id_value == "") and employee.room_id:
                data["room_id"] = employee.room_id

    t = Ticket(**data)
    db.add(t)
    db.commit()
    db.refresh(t)

    # --- Читаем настройки уведомлений и распределения ---
    cfg = _get_settings_map(db, [
        "auto_assign_tickets",
        "ticket_notifications_enabled",
        "ticket_notification_channels",
        "ticket_notification_recipients",
        "ticket_notification_custom_users",
        "ticket_distribution_method",
        "ticket_distribution_specialists",
    ])

    # 1) Автораспределение (если включено)
    assignee = None
    if _bool(cfg.get("auto_assign_tickets"), False):
        try:
            from backend.modules.it.services.telegram_service import telegram_service
            assignee = telegram_service.auto_assign_to_it_specialist(
                db, t,
                method=cfg.get("ticket_distribution_method", "least_loaded"),
                specialist_ids_json=cfg.get("ticket_distribution_specialists"),
            )
        except Exception as e:
            print(f"[Tickets] Ошибка автораспределения: {e}")

    # 2) Уведомления (если включены)
    if _bool(cfg.get("ticket_notifications_enabled"), True):
        channels = (cfg.get("ticket_notification_channels") or "in_app,telegram").split(",")
        recipients_mode = cfg.get("ticket_notification_recipients") or "all_it"
        custom_users_json = cfg.get("ticket_notification_custom_users")

        try:
            _send_new_ticket_notifications(
                db, t, assignee,
                channels=channels,
                recipients_mode=recipients_mode,
                custom_users_json=custom_users_json,
                source="web",
            )
        except Exception as e:
            print(f"[Tickets] Ошибка уведомлений: {e}")

        # Telegram уведомления
        if "telegram" in channels:
            try:
                from backend.modules.it.services.telegram_service import telegram_service
                await telegram_service.notify_new_ticket(db, t.id, t.title, source="web")
                if assignee and assignee.telegram_id:
                    await telegram_service.notify_ticket_assigned(db, assignee.id, t.id, t.title)
            except Exception as e:
                print(f"[Tickets] Ошибка Telegram-уведомлений: {e}")

    # Уведомление в RocketChat (только если тикет не из RocketChat)
    if t.source != "rocketchat":
        try:
            from backend.modules.it.services.rocketchat_service import rocketchat_service
            await rocketchat_service.send_channel_message(
                db, f"Новая заявка #{str(t.id)[:8]}: {t.title}"
            )
        except Exception:
            pass

    return t


@router.patch(
    "/{ticket_id}",
    response_model=TicketOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
async def update_ticket(
    ticket_id: UUID,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Ticket:
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    role = _user_it_role(user)
    if role == "employee":
        if t.creator_id != user.id:
            raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
        update_data = payload.model_dump(exclude_unset=True)
        # Сотрудники не могут менять критические поля
        for k in (
            "status",
            "assignee_id",
            "priority",
            "resolved_at",
            "closed_at",
            "consumables",
        ):
            update_data.pop(k, None)
    else:
        update_data = payload.model_dump(exclude_unset=True)

    # Извлекаем расходники отдельно
    consumables_data = update_data.pop("consumables", None)

    # Сохраняем старые значения для логирования
    old_data = {
        "status": t.status,
        "priority": t.priority,
        "category": t.category,
        "assignee_id": t.assignee_id,
        "title": t.title,
        "description": t.description,
        "equipment_id": t.equipment_id,
        "room_id": t.room_id,
        "resolved_at": t.resolved_at,
        "closed_at": t.closed_at,
    }

    # Применяем изменения
    for k, v in update_data.items():
        setattr(t, k, v)

    # Автовыставление resolved_at / closed_at для замера времени выполнения в отчётах
    now = datetime.now(UTC)
    if t.status == "resolved" and t.resolved_at is None:
        t.resolved_at = now
    if t.status == "closed" and t.closed_at is None:
        t.closed_at = now

    # Сохраняем расходники если переданы
    if consumables_data is not None:
        # Удаляем старые несписанные расходники
        db.query(TicketConsumable).filter(
            TicketConsumable.ticket_id == ticket_id,
            TicketConsumable.is_written_off == False,
        ).delete()

        # Добавляем новые
        for item in consumables_data:
            tc = TicketConsumable(
                ticket_id=ticket_id,
                consumable_id=item["consumable_id"],
                quantity=item.get("quantity", 1),
                is_written_off=False,
            )
            db.add(tc)

    # Логируем изменения
    log_ticket_changes(
        db=db,
        ticket_id=ticket_id,
        changed_by_id=user.id,
        old_data=old_data,
        new_data=update_data,
    )

    status_changed = "status" in update_data and update_data.get("status") != old_data.get("status")

    db.commit()
    db.refresh(t)

    # Уведомления о смене статуса (для создателя/отправителя)
    if status_changed:
        try:
            # Имя исполнителя для шаблонов (если назначен)
            assignee_name = None
            if t.assignee_id:
                assignee = db.query(User).filter(User.id == t.assignee_id).first()
                assignee_name = assignee.full_name if assignee else None

            # Email отправителю (если тикет создан из письма)
            from backend.modules.it.services.email_service import email_service
            if t.email_sender:
                msg_id = await email_service.send_ticket_status_notification_to_email(
                    db,
                    to_email=t.email_sender,
                    ticket_id=str(t.id),
                    ticket_title=t.title,
                    new_status=t.status,
                    assignee_name=assignee_name,
                    in_reply_to=t.email_message_id,
                    references=[t.email_message_id] if t.email_message_id else None,
                )
                if msg_id:
                    # Обновляем message_id, чтобы ответы на последующие письма корректно цеплялись
                    t.email_message_id = msg_id
                    db.commit()

            # Email зарегистрированному создателю
            if t.creator_id:
                await email_service.send_ticket_status_notification(
                    db,
                    user_id=t.creator_id,
                    ticket_id=str(t.id),
                    ticket_title=t.title,
                    new_status=t.status,
                    assignee_name=assignee_name,
                )

            # Telegram (если привязан)
            try:
                from backend.modules.it.services.telegram_service import telegram_service
                if t.creator_id:
                    await telegram_service.notify_ticket_status_changed(
                        db,
                        t.creator_id,
                        t.id,
                        t.title,
                        t.status,
                    )
            except Exception:
                pass

            # RocketChat (если тикет из RocketChat)
            try:
                if t.rocketchat_sender:
                    from backend.modules.it.services.rocketchat_service import rocketchat_service
                    await rocketchat_service.notify_ticket_status_changed(db, t)
            except Exception:
                pass
        except Exception:
            # Не блокируем обновление тикета из-за уведомлений
            pass

    return t


@router.post(
    "/{ticket_id}/reply-email",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def reply_ticket_via_email(
    ticket_id: UUID,
    payload: TicketReplyEmailRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Ответить отправителю по email (для email-тикетов).
    Ответ уходит в виде письма, на которое можно ответить — ответ попадёт в комментарии.
    """
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    message = (payload.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Текст ответа пуст")

    # Куда отвечаем: либо email_sender, либо email зарегистрированного создателя
    to_email = t.email_sender
    if not to_email and t.creator_id:
        creator = db.query(User).filter(User.id == t.creator_id).first()
        to_email = creator.email if creator else None
    if not to_email:
        raise HTTPException(status_code=400, detail="У тикета нет email отправителя")

    from backend.modules.it.services.email_service import email_service
    msg_id, err = await email_service.send_ticket_reply_detailed(
        db,
        to_email=to_email,
        ticket_id=str(t.id),
        ticket_subject=t.title,
        reply_content=message,
        sender_name=user.full_name,
        in_reply_to=t.email_message_id,
        references=[t.email_message_id] if t.email_message_id else None,
    )
    if not msg_id:
        raise HTTPException(
            status_code=400,
            detail=err or "Не удалось отправить email",
        )

    # Обновляем email_message_id, чтобы ответы цеплялись по In-Reply-To
    t.email_message_id = msg_id
    db.commit()

    return {"success": True, "message_id": msg_id}


@router.post(
    "/{ticket_id}/assign-user",
    response_model=TicketOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def assign_user_to_ticket(
    ticket_id: UUID,
    payload: TicketAssignUser,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Ticket:
    """
    Привязать email-тикет к зарегистрированному пользователю.

    Работает только для тикетов со статусом 'pending_user'.
    После привязки статус меняется на 'new'.
    """
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if t.status != "pending_user":
        raise HTTPException(
            status_code=400,
            detail="Привязка возможна только для заявок со статусом 'pending_user'",
        )

    # Проверяем что пользователь существует
    target_user = db.query(User).filter(User.id == payload.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Сохраняем старые значения для логирования
    old_status = t.status
    old_creator_id = t.creator_id

    # Обновляем тикет
    t.creator_id = payload.user_id
    t.status = "new"

    # Логируем изменения
    log_ticket_changes(
        db=db,
        ticket_id=ticket_id,
        changed_by_id=user.id,
        old_data={"status": old_status, "creator_id": old_creator_id},
        new_data={"status": "new", "creator_id": payload.user_id},
        tracked_fields=["status", "creator_id"],
    )

    db.commit()
    db.refresh(t)
    return t


@router.post(
    "/{ticket_id}/assign-employee",
    response_model=TicketOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def assign_employee_to_ticket(
    ticket_id: UUID,
    payload: TicketAssignEmployee,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """
    Привязать email-тикет к сотруднику (Employee).

    Если у сотрудника есть связанный user_id — дополнительно проставляем creator_id,
    чтобы тикет был виден этому пользователю, и переводим статус в 'new'.
    """
    from backend.modules.hr.models.employee import Employee

    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    old_status = t.status
    old_creator_id = t.creator_id
    old_employee_id = t.employee_id

    t.employee_id = employee.id
    if employee.user_id:
        t.creator_id = employee.user_id
    if t.status == "pending_user":
        t.status = "new"

    # Запоминаем соответствие email -> сотрудник для будущих email-тикетов
    if t.email_sender:
        email_addr = (t.email_sender or "").strip().lower()
        if email_addr:
            m = (
                db.query(EmailSenderEmployeeMap)
                .filter(EmailSenderEmployeeMap.email == email_addr)
                .first()
            )
            if m:
                m.employee_id = employee.id
            else:
                db.add(EmailSenderEmployeeMap(email=email_addr, employee_id=employee.id))

    log_ticket_changes(
        db=db,
        ticket_id=ticket_id,
        changed_by_id=user.id,
        old_data={"status": old_status, "creator_id": old_creator_id, "employee_id": old_employee_id},
        new_data={"status": t.status, "creator_id": t.creator_id, "employee_id": t.employee_id},
        tracked_fields=["status", "creator_id", "employee_id"],
    )

    db.commit()
    db.refresh(t)

    d = TicketOut.model_validate(t).model_dump()
    d["employee_name"] = employee.full_name
    return d


@router.post(
    "/{ticket_id}/assign-executor",
    response_model=TicketOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def assign_executor_to_ticket(
    ticket_id: UUID,
    payload: TicketAssignExecutor,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Ticket:
    """
    Назначить исполнителя заявки или снять его (user_id=null).
    Исполнителю отправляются: уведомление в Telegram и уведомление в системе.
    """
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    old_assignee_id = t.assignee_id
    new_assignee_id = payload.user_id

    if new_assignee_id is None:
        t.assignee_id = None
        log_ticket_changes(
            db=db,
            ticket_id=ticket_id,
            changed_by_id=user.id,
            old_data={"assignee_id": old_assignee_id},
            new_data={"assignee_id": None},
            tracked_fields=["assignee_id"],
        )
        db.commit()
        db.refresh(t)
        return t

    target = db.query(User).filter(User.id == new_assignee_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Аудитор не может быть назначен исполнителем
    if target.get_role("it") == "auditor":
        raise HTTPException(
            status_code=400,
            detail="На пользователя с ролью «Аудитор» нельзя назначить заявку",
        )

    t.assignee_id = new_assignee_id
    log_ticket_changes(
        db=db,
        ticket_id=ticket_id,
        changed_by_id=user.id,
        old_data={"assignee_id": old_assignee_id},
        new_data={"assignee_id": new_assignee_id},
        tracked_fields=["assignee_id"],
    )

    notify = old_assignee_id != new_assignee_id

    if notify:
        notification = Notification(
            user_id=new_assignee_id,
            title="Вам назначена заявка",
            message=f'Вам назначена заявка: "{t.title}"',
            type="info",
            related_type="ticket",
            related_id=ticket_id,
        )
        db.add(notification)

    db.commit()
    db.refresh(t)

    if notify:
        try:
            from backend.modules.it.services.telegram_service import telegram_service
            await telegram_service.notify_ticket_assigned(db, new_assignee_id, t.id, t.title)
        except Exception:
            pass

        # RocketChat (если тикет из RocketChat)
        try:
            if t.rocketchat_sender:
                from backend.modules.it.services.rocketchat_service import rocketchat_service
                assignee_name = target.full_name if target else "неизвестен"
                await rocketchat_service.notify_ticket_assigned(db, t, assignee_name)
        except Exception:
            pass

    return t


@router.delete(
    "/{ticket_id}",
    status_code=200,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def delete_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    db.delete(t)
    db.commit()
    return {"message": "Заявка удалена"}


# --- Расходники тикета ---


@router.get(
    "/{ticket_id}/consumables",
    response_model=List[TicketConsumableOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee", "auditor"]))],
)
def get_ticket_consumables(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[dict]:
    """Получить расходники привязанные к тикету"""
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    role = _user_it_role(user)
    if role == "employee" and t.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")

    # Получаем расходники с JOIN на Consumable
    ticket_consumables = (
        db.query(TicketConsumable, Consumable.name, Consumable.model)
        .join(Consumable, TicketConsumable.consumable_id == Consumable.id)
        .filter(TicketConsumable.ticket_id == ticket_id)
        .all()
    )

    result = []
    for tc, name, model in ticket_consumables:
        result.append(
            {
                "id": tc.id,
                "ticket_id": tc.ticket_id,
                "consumable_id": tc.consumable_id,
                "consumable_name": name,
                "consumable_model": model,
                "quantity": tc.quantity,
                "is_written_off": tc.is_written_off,
                "written_off_at": tc.written_off_at,
                "created_at": tc.created_at,
            }
        )

    return result


@router.post(
    "/{ticket_id}/write-off-consumables",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def write_off_ticket_consumables(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """
    Списать расходники тикета со склада.

    Создает записи ConsumableIssue и уменьшает quantity_in_stock.
    Вызывается при закрытии тикета или вручную.
    """
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    # Получаем несписанные расходники тикета
    ticket_consumables = (
        db.query(TicketConsumable)
        .filter(
            TicketConsumable.ticket_id == ticket_id,
            TicketConsumable.is_written_off == False,
        )
        .all()
    )

    if not ticket_consumables:
        return {"message": "Нет расходников для списания", "written_off": 0}

    written_off = []
    errors = []

    for tc in ticket_consumables:
        consumable = (
            db.query(Consumable).filter(Consumable.id == tc.consumable_id).first()
        )
        if not consumable:
            errors.append(f"Расходник {tc.consumable_id} не найден")
            continue

        if consumable.quantity_in_stock < tc.quantity:
            errors.append(
                f"Недостаточно расходника '{consumable.name}' на складе "
                f"(есть: {consumable.quantity_in_stock}, нужно: {tc.quantity})"
            )
            continue

        # Создаем запись о выдаче
        issue = ConsumableIssue(
            consumable_id=tc.consumable_id,
            quantity=tc.quantity,
            issued_to_id=t.creator_id,  # Выдаем создателю тикета
            issued_by_id=user.id,
            reason=f"Списание по заявке #{str(ticket_id)[:8]}",
        )
        db.add(issue)

        # Уменьшаем количество на складе
        consumable.quantity_in_stock -= tc.quantity

        # Помечаем как списанное
        tc.is_written_off = True
        tc.written_off_at = datetime.utcnow()

        written_off.append(
            {
                "consumable_id": str(tc.consumable_id),
                "consumable_name": consumable.name,
                "quantity": tc.quantity,
            }
        )

    db.commit()

    result = {
        "message": f"Списано расходников: {len(written_off)}",
        "written_off": written_off,
    }
    if errors:
        result["errors"] = errors

    return result
