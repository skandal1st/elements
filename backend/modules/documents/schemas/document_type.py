"""Схемы для типов документов."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    code: str
    default_route_id: Optional[UUID] = None
    is_active: bool = True


class DocumentTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    code: Optional[str] = None
    default_route_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class DocumentTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    code: str
    default_route_id: Optional[UUID] = None
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
