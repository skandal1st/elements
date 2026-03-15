"""Схемы для файлов договоров (общие для contract и act)."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ContractFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: str
    file_path: str
    file_name: str
    created_at: datetime | None
