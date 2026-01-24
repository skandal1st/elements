"""
Схемы для истории перемещений оборудования
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EquipmentHistoryBase(BaseModel):
    from_user_id: Optional[int] = None  # ID сотрудника (employees.id)
    to_user_id: Optional[int] = None  # ID сотрудника (employees.id)
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    reason: Optional[str] = None


class EquipmentHistoryOut(EquipmentHistoryBase):
    id: UUID
    equipment_id: UUID
    changed_by_id: UUID
    created_at: datetime
    
    # Дополнительные поля из JOIN
    from_user_name: Optional[str] = None
    to_user_name: Optional[str] = None
    changed_by_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class ChangeOwnerRequest(BaseModel):
    new_owner_id: Optional[int] = None  # ID сотрудника (employees.id)
    new_location_department: Optional[str] = None
    new_location_room: Optional[str] = None
    reason: Optional[str] = None
