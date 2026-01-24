"""
Схемы для кабинетов (комнат)
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RoomBase(BaseModel):
    building_id: UUID
    name: str
    floor: Optional[int] = None
    description: Optional[str] = None
    is_active: bool = True


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    floor: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class RoomOut(RoomBase):
    id: UUID
    building_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class RoomWithDetails(RoomOut):
    equipment_count: int = 0
    employees_count: int = 0
