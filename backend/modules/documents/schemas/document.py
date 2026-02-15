"""Схемы для документов."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    document_type_id: Optional[UUID] = None
    approval_route_id: Optional[UUID] = None


class DocumentVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    version: int
    file_path: str
    file_name: str
    file_size: int
    mime_type: Optional[str] = None
    change_note: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None


class DocumentAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    file_path: str
    file_name: str
    file_size: int
    mime_type: Optional[str] = None
    uploaded_by: Optional[UUID] = None
    created_at: Optional[datetime] = None


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_type_id: Optional[UUID] = None
    template_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    status: str
    current_version: int
    creator_id: UUID
    approval_route_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    creator_name: Optional[str] = None
    document_type_name: Optional[str] = None


class DocumentDetailOut(DocumentOut):
    versions: List[DocumentVersionOut] = []
    attachments: List[DocumentAttachmentOut] = []
