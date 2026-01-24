"""
Схемы для комментариев к заявкам
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TicketCommentBase(BaseModel):
    content: str
    attachments: Optional[list[str]] = None


class TicketCommentCreate(TicketCommentBase):
    pass


class TicketCommentUpdate(BaseModel):
    content: str


class TicketCommentOut(TicketCommentBase):
    id: UUID
    ticket_id: UUID
    user_id: UUID
    created_at: datetime
    
    # Дополнительные поля из JOIN
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
