"""Схемы для IT Ticket (заявки)."""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TicketBase(BaseModel):
    title: str
    description: str
    category: str
    priority: str = "medium"
    equipment_id: Optional[UUID] = None
    room_id: Optional[UUID] = None  # Кабинет, связанный с заявкой
    desired_resolution_date: Optional[datetime] = None


class TicketCreate(TicketBase):
    source: str = "web"  # web, email, api, telegram
    email_sender: Optional[str] = None
    email_message_id: Optional[str] = None
    for_employee_id: Optional[int] = None  # ID сотрудника для заявки (только для IT)


class TicketConsumableItem(BaseModel):
    """Расходник для списания"""

    consumable_id: UUID
    quantity: int = 1


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assignee_id: Optional[UUID] = None
    equipment_id: Optional[UUID] = None
    room_id: Optional[UUID] = None
    desired_resolution_date: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    rating: Optional[int] = None
    rating_comment: Optional[str] = None
    # Расходники для списания при закрытии
    consumables: Optional[List[TicketConsumableItem]] = None


class TicketOut(TicketBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    creator_id: Optional[UUID] = None  # Nullable для email-тикетов
    employee_id: Optional[int] = None
    employee_name: Optional[str] = None
    assignee_id: Optional[UUID] = None
    attachments: Optional[List[str]] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    rating: Optional[int] = None
    rating_comment: Optional[str] = None
    # Новые поля для источника
    source: str = "web"
    email_sender: Optional[str] = None
    email_message_id: Optional[str] = None
    rocketchat_message_id: Optional[str] = None
    rocketchat_sender: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TicketAssignUser(BaseModel):
    """Схема для привязки email-тикета к пользователю"""

    user_id: UUID


class TicketAssignExecutor(BaseModel):
    """Схема для назначения исполнителя заявки. user_id=null — снять исполнителя."""

    user_id: Optional[UUID] = None


class TicketConsumableOut(BaseModel):
    """Выходная схема для расходника тикета"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    consumable_id: UUID
    consumable_name: Optional[str] = None
    consumable_model: Optional[str] = None
    quantity: int
    is_written_off: bool
    written_off_at: Optional[datetime] = None
    created_at: datetime


class TicketHistoryOut(BaseModel):
    """Схема для истории изменений тикета"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    changed_by_id: UUID
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime
    # Дополнительные поля для JOIN
    changed_by_name: Optional[str] = None
