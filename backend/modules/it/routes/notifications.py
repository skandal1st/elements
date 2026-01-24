"""Роуты /it/notifications — уведомления."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, get_current_user
from backend.modules.it.models import Notification
from backend.modules.it.schemas.notification import (
    NotificationOut,
    NotificationListResponse,
    UnreadCountResponse,
)
from backend.modules.hr.models.user import User


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationListResponse)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    unread_only: bool = Query(False, alias="unread_only"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> NotificationListResponse:
    """Получить список уведомлений текущего пользователя"""
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    
    if unread_only:
        q = q.filter(Notification.is_read == False)
    
    total = q.count()
    
    notifications = q.order_by(Notification.created_at.desc()).limit(limit).offset(offset).all()
    
    # Получаем количество непрочитанных
    unread_count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).scalar() or 0
    
    return NotificationListResponse(
        data=notifications,
        unread_count=unread_count,
        total=total,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCountResponse:
    """Получить количество непрочитанных уведомлений"""
    count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).scalar() or 0
    
    return UnreadCountResponse(count=count)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_as_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationOut:
    """Отметить уведомление как прочитанное"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    
    return notification


@router.patch("/read-all", status_code=200)
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Отметить все уведомления как прочитанные"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    
    return {"message": "Все уведомления отмечены как прочитанные"}


@router.delete("/{notification_id}", status_code=200)
def delete_notification(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Удалить уведомление"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Уведомление удалено"}


@router.delete("/clear-all", status_code=200)
def clear_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Удалить все прочитанные уведомления"""
    deleted_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == True,
    ).delete()
    db.commit()
    
    return {"message": "Прочитанные уведомления удалены", "deleted_count": deleted_count}
