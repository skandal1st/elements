"""Роуты /it/tickets — заявки (тикеты)."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db, require_it_roles
from backend.modules.it.models import Ticket, TicketHistory
from backend.modules.it.schemas.ticket import (
    TicketAssignUser,
    TicketCreate,
    TicketHistoryOut,
    TicketOut,
    TicketUpdate,
)
from backend.modules.it.services.ticket_history import log_ticket_changes

router = APIRouter(prefix="/tickets", tags=["tickets"])


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
def create_ticket(
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
    return t


@router.patch(
    "/{ticket_id}",
    response_model=TicketOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def update_ticket(
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
        for k in ("status", "assignee_id", "priority", "resolved_at", "closed_at"):
            update_data.pop(k, None)
    else:
        update_data = payload.model_dump(exclude_unset=True)

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

    # Логируем изменения
    log_ticket_changes(
        db=db,
        ticket_id=ticket_id,
        changed_by_id=user.id,
        old_data=old_data,
        new_data=update_data,
    )

    db.commit()
    db.refresh(t)
    return t


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
