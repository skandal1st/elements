"""
Схемы для уведомлений
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class NotificationBase(BaseModel):
    title: str
    message: str
    type: str  # info, warning, error, success
    related_type: Optional[str] = None
    related_id: Optional[UUID] = None
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ['info', 'warning', 'error', 'success']:
            raise ValueError('Тип должен быть одним из: info, warning, error, success')
        return v


class NotificationCreate(NotificationBase):
    user_id: UUID


class NotificationOut(NotificationBase):
    id: UUID
    user_id: UUID
    is_read: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    data: list[NotificationOut]
    unread_count: int
    total: int


class UnreadCountResponse(BaseModel):
    count: int
