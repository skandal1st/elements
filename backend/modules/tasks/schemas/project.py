"""Схемы для проектов."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    """Базовая схема проекта."""

    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    color: Optional[str] = "#3B82F6"
    icon: Optional[str] = None
    is_personal: bool = True
    settings: Optional[Dict[str, Any]] = None


class ProjectCreate(ProjectBase):
    """Схема для создания проекта."""

    pass


class ProjectUpdate(BaseModel):
    """Схема для обновления проекта."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_personal: Optional[bool] = None
    is_archived: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


class ProjectOut(ProjectBase):
    """Схема для вывода проекта."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    is_archived: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProjectWithStats(ProjectOut):
    """Проект со статистикой по задачам."""

    total_tasks: int = 0
    completed_tasks: int = 0
    in_progress_tasks: int = 0
    overdue_tasks: int = 0
    # Информация о шаринге
    shared_with_count: int = 0
    # Права текущего пользователя
    user_permission: str = "owner"  # owner, admin, edit, view
