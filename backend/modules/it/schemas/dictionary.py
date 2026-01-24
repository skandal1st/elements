"""
Схемы для справочников
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator


class DictionaryBase(BaseModel):
    dictionary_type: str  # ticket_category, ticket_priority, ticket_status, equipment_category, equipment_status, consumable_type
    key: str
    label: str
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    
    @field_validator('key')
    @classmethod
    def validate_key(cls, v: str) -> str:
        if not v.replace('_', '').isalnum() or not v.replace('_', '').islower():
            raise ValueError('Ключ должен содержать только латиницу в нижнем регистре и _')
        return v


class DictionaryCreate(DictionaryBase):
    pass


class DictionaryUpdate(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class DictionaryOut(DictionaryBase):
    id: UUID
    is_system: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
