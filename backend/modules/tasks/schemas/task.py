"""Схемы для задач."""

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# --- Label schemas ---


class LabelBase(BaseModel):
    """Базовая схема метки."""

    name: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = "#6B7280"


class LabelCreate(LabelBase):
    """Схема для создания метки."""

    project_id: UUID


class LabelUpdate(BaseModel):
    """Схема для обновления метки."""

    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = None


class LabelOut(LabelBase):
    """Схема для вывода метки."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    created_at: Optional[datetime] = None


# --- Checklist schemas ---


class ChecklistItemBase(BaseModel):
    """Базовая схема элемента чеклиста."""

    title: str = Field(..., min_length=1, max_length=255)
    is_completed: bool = False
    order_index: int = 0


class ChecklistItemCreate(BaseModel):
    """Схема для создания элемента чеклиста."""

    title: str = Field(..., min_length=1, max_length=255)
    order_index: Optional[int] = None


class ChecklistItemUpdate(BaseModel):
    """Схема для обновления элемента чеклиста."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    is_completed: Optional[bool] = None
    order_index: Optional[int] = None


class ChecklistItemOut(ChecklistItemBase):
    """Схема для вывода элемента чеклиста."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    created_at: Optional[datetime] = None


# --- Task schemas ---


class RecurrenceConfig(BaseModel):
    """Конфигурация повторяющихся задач."""

    type: Literal["daily", "weekly", "monthly"]
    interval: int = 1
    end_date: Optional[datetime] = None


class TaskBase(BaseModel):
    """Базовая схема задачи."""

    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    priority: Literal["low", "medium", "high", "urgent"] = "medium"
    due_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    estimated_hours: Optional[Decimal] = None
    labels: Optional[List[UUID]] = None
    recurrence: Optional[RecurrenceConfig] = None
    # Интеграция
    linked_ticket_id: Optional[UUID] = None
    linked_employee_id: Optional[UUID] = None


class TaskCreate(TaskBase):
    """Схема для создания задачи."""

    project_id: UUID
    parent_id: Optional[UUID] = None
    assignee_id: Optional[UUID] = None
    status: Optional[Literal["todo", "in_progress", "review", "done", "cancelled"]] = "todo"
    # Чеклист при создании
    checklist: Optional[List[ChecklistItemCreate]] = None


class TaskUpdate(BaseModel):
    """Схема для обновления задачи."""

    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    status: Optional[Literal["todo", "in_progress", "review", "done", "cancelled"]] = None
    priority: Optional[Literal["low", "medium", "high", "urgent"]] = None
    assignee_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    estimated_hours: Optional[Decimal] = None
    actual_hours: Optional[Decimal] = None
    labels: Optional[List[UUID]] = None
    recurrence: Optional[RecurrenceConfig] = None
    parent_id: Optional[UUID] = None
    linked_ticket_id: Optional[UUID] = None
    linked_employee_id: Optional[UUID] = None


class TaskOut(BaseModel):
    """Схема для вывода задачи."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    parent_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    creator_id: UUID
    assignee_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    start_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    order_index: int = 0
    labels: Optional[List[UUID]] = None
    recurrence: Optional[Dict[str, Any]] = None
    estimated_hours: Optional[Decimal] = None
    actual_hours: Optional[Decimal] = None
    linked_ticket_id: Optional[UUID] = None
    linked_employee_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TaskWithDetails(TaskOut):
    """Задача с деталями (чеклисты, комментарии и т.д.)."""

    subtasks_count: int = 0
    subtasks_completed: int = 0
    checklist_items: List[ChecklistItemOut] = []
    comments_count: int = 0
    # Информация о пользователях
    creator_name: Optional[str] = None
    assignee_name: Optional[str] = None


class KanbanMove(BaseModel):
    """Схема для перемещения задачи на канбан-доске."""

    status: Literal["todo", "in_progress", "review", "done", "cancelled"]
    order_index: int = Field(..., ge=0)
    # Опционально: позиционирование относительно другой задачи
    before_task_id: Optional[UUID] = None
    after_task_id: Optional[UUID] = None


# --- Comment schemas ---


class TaskCommentCreate(BaseModel):
    """Схема для создания комментария."""

    content: str = Field(..., min_length=1)
    attachments: Optional[List[str]] = None


class TaskCommentOut(BaseModel):
    """Схема для вывода комментария."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    user_id: UUID
    content: str
    attachments: Optional[List[str]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Информация о пользователе
    user_name: Optional[str] = None


# --- History schemas ---


class TaskHistoryOut(BaseModel):
    """Схема для вывода истории изменений."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    changed_by_id: UUID
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: Optional[datetime] = None
    # Информация о пользователе
    changed_by_name: Optional[str] = None
