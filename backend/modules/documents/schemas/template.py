"""Схемы для шаблонов документов."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PlaceholderSchema(BaseModel):
    id: Optional[str] = None
    key: str
    label: str
    type: str = "text"
    required: bool = True
    options: List[str] = []
    default_value: str = ""


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    document_type_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    placeholders: Optional[List[PlaceholderSchema]] = None


class SetPlaceholderRequest(BaseModel):
    paragraph_index: int
    start: int
    end: int
    placeholder: PlaceholderSchema


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_type_id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    file_path: str
    file_name: str
    placeholders: List[Any] = []
    version: int
    is_active: bool
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class GenerateFromTemplateRequest(BaseModel):
    template_id: UUID
    title: str
    description: Optional[str] = None
    document_type_id: Optional[UUID] = None
    approval_route_id: Optional[UUID] = None
    values: Dict[str, str] = {}
