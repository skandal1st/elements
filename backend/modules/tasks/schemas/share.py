"""Схемы для шаринга проектов."""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectShareBase(BaseModel):
    """Базовая схема шаринга."""

    share_type: Literal["user", "department"]
    target_id: UUID
    permission: Literal["view", "edit", "admin"] = "view"


class ProjectShareCreate(ProjectShareBase):
    """Схема для создания шаринга."""

    pass


class ProjectShareUpdate(BaseModel):
    """Схема для обновления шаринга."""

    permission: Literal["view", "edit", "admin"]


class ProjectShareOut(ProjectShareBase):
    """Схема для вывода шаринга."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    created_at: Optional[datetime] = None
    # Дополнительная информация о получателе
    target_name: Optional[str] = None
    target_email: Optional[str] = None
