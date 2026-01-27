"""Роуты /it/tickets — заявки (тикеты)."""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db, require_it_roles
from backend.modules.it.models import (
    Consumable,
    ConsumableIssue,
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

UTC = timezone.utc

router = APIRouter(prefix="/tickets", tags=["tickets"])

class TicketReplyEmailRequest(BaseModel):
    message: str


def _user_it_role(user: User) -> str:
    if user.is_superuser:
        return "admin"
    return user.get_role("it") or "employee"


@router.get(
    "/",
    response_model=List[TicketOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def list_tickets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> List[Ticket]:
    role = _user_it_role(user)
    q = db.query(Ticket)
    if role == "employee":
        q = q.filter(Ticket.creator_id == user.id)
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
    return q.offset(offset).limit(page_size).all()


@router.get(
    "/{ticket_id}",
    response_model=TicketOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def get_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Ticket:
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    role = _user_it_role(user)
    if role == "employee" and t.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    return t


@router.get(
    "/{ticket_id}/history",
    response_model=List[TicketHistoryOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
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

    # Если room_id не указан, пытаемся получить кабинет сотрудника
    if not data.get("room_id"):
        employee = db.query(Employee).filter(Employee.user_id == user.id).first()
        if employee and employee.room_id:
            data["room_id"] = employee.room_id

    t = Ticket(**data)
    db.add(t)
    db.commit()
    db.refresh(t)

    # Уведомление IT-специалистов в Telegram
    try:
        from backend.modules.it.services.telegram_service import telegram_service
        await telegram_service.notify_new_ticket(db, t.id, t.title)
    except Exception:
        pass  # Не блокируем создание заявки при ошибке уведомления

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
    msg_id = await email_service.send_ticket_reply(
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
        raise HTTPException(status_code=500, detail="Не удалось отправить email")

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
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
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
