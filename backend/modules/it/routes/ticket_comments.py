"""Роуты /it/tickets/{ticket_id}/comments — комментарии к заявкам."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.it.models import Ticket, TicketComment
from backend.modules.it.schemas.ticket_comment import (
    TicketCommentCreate,
    TicketCommentOut,
    TicketCommentUpdate,
)
from backend.modules.hr.models.user import User


router = APIRouter(prefix="/tickets/{ticket_id}/comments", tags=["ticket-comments"])

def _normalize_attachment_path(p: str) -> str:
    s = (p or "").strip()
    if not s:
        return s
    if s.startswith("http://") or s.startswith("https://"):
        return s
    if s.startswith("/"):
        return s
    if s.startswith("uploads/") or s.startswith("uploads\\"):
        return "/" + s.replace("\\", "/")
    return "/uploads/tickets/" + s.replace("\\", "/")


def _user_it_role(user: User) -> str:
    """Определяет роль пользователя в IT модуле"""
    if user.is_superuser:
        return "admin"
    return user.get_role("it") or "employee"


@router.get("/", response_model=List[TicketCommentOut])
def list_comments(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[TicketCommentOut]:
    """Получить список комментариев к заявке"""
    # Проверяем существование заявки
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    # Проверяем доступ: employee может видеть только свои заявки
    role = _user_it_role(user)
    if role == "employee" and ticket.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    # Получаем комментарии с информацией о пользователях
    comments = (
        db.query(TicketComment)
        .filter(TicketComment.ticket_id == ticket_id)
        .order_by(TicketComment.created_at.asc())
        .all()
    )
    
    # Формируем ответ с именами пользователей
    result = []
    for comment in comments:
        comment_dict = {
            "id": comment.id,
            "ticket_id": comment.ticket_id,
            "user_id": comment.user_id,
            "content": comment.content,
            "attachments": [_normalize_attachment_path(x) for x in (comment.attachments or [])] or None,
            "created_at": comment.created_at,
        }
        
        # Добавляем информацию о пользователе
        if comment.user:
            comment_dict["user_name"] = comment.user.full_name
            comment_dict["user_role"] = comment.user.get_role("it") or "employee"
        
        result.append(TicketCommentOut(**comment_dict))
    
    return result


@router.post("/", response_model=TicketCommentOut, status_code=201)
def create_comment(
    ticket_id: UUID,
    payload: TicketCommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TicketCommentOut:
    """Создать комментарий к заявке"""
    # Проверяем существование заявки
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    # Проверяем доступ: employee может комментировать только свои заявки
    role = _user_it_role(user)
    if role == "employee" and ticket.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    # Создаем комментарий
    comment = TicketComment(
        ticket_id=ticket_id,
        user_id=user.id,
        content=payload.content,
        attachments=payload.attachments,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    # Формируем ответ
    return TicketCommentOut(
        id=comment.id,
        ticket_id=comment.ticket_id,
        user_id=comment.user_id,
        content=comment.content,
        attachments=[_normalize_attachment_path(x) for x in (comment.attachments or [])] or None,
        created_at=comment.created_at,
        user_name=user.full_name,
        user_role=role,
    )


@router.patch("/{comment_id}", response_model=TicketCommentOut)
def update_comment(
    ticket_id: UUID,
    comment_id: UUID,
    payload: TicketCommentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TicketCommentOut:
    """Обновить комментарий"""
    comment = db.query(TicketComment).filter(
        TicketComment.id == comment_id,
        TicketComment.ticket_id == ticket_id,
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    
    # Только автор может редактировать свой комментарий
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    comment.content = payload.content
    db.commit()
    db.refresh(comment)
    
    role = _user_it_role(user)
    return TicketCommentOut(
        id=comment.id,
        ticket_id=comment.ticket_id,
        user_id=comment.user_id,
        content=comment.content,
        attachments=[_normalize_attachment_path(x) for x in (comment.attachments or [])] or None,
        created_at=comment.created_at,
        user_name=user.full_name,
        user_role=role,
    )


@router.delete("/{comment_id}", status_code=200)
def delete_comment(
    ticket_id: UUID,
    comment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Удалить комментарий"""
    comment = db.query(TicketComment).filter(
        TicketComment.id == comment_id,
        TicketComment.ticket_id == ticket_id,
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    
    role = _user_it_role(user)
    # Автор или admin/it_specialist могут удалять
    if comment.user_id != user.id and role not in ("admin", "it_specialist"):
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    db.delete(comment)
    db.commit()
    return {"message": "Комментарий удален"}
