"""Схемы для IT Building (здания)."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BuildingBase(BaseModel):
    name: str
    address: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class BuildingCreate(BuildingBase):
    pass


class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class BuildingOut(BuildingBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
