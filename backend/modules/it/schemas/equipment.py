"""Схемы для IT Equipment (оборудование)."""

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EquipmentBase(BaseModel):
    name: str
    model: Optional[str] = None
    model_id: Optional[UUID] = (
        None  # ID модели из справочника (производитель -> марка -> модель)
    )
    inventory_number: str
    serial_number: Optional[str] = None
    category: str
    status: str = "in_stock"
    purchase_date: Optional[date] = None
    cost: Optional[Decimal] = None
    warranty_until: Optional[date] = None
    current_owner_id: Optional[int] = None  # ID сотрудника (employees.id)
    room_id: Optional[UUID] = None  # Кабинет, где находится оборудование
    location_department: Optional[str] = None  # Оставляем для обратной совместимости
    location_room: Optional[str] = None  # Оставляем для обратной совместимости
    manufacturer: Optional[str] = None
    ip_address: Optional[str] = None
    specifications: Optional[dict[str, Any]] = None
    attachments: Optional[List[str]] = None


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    model_id: Optional[UUID] = (
        None  # ID модели из справочника (производитель -> марка -> модель)
    )
    inventory_number: Optional[str] = None
    serial_number: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    purchase_date: Optional[date] = None
    cost: Optional[Decimal] = None
    warranty_until: Optional[date] = None
    current_owner_id: Optional[int] = None  # ID сотрудника (employees.id)
    room_id: Optional[UUID] = None
    location_department: Optional[str] = None
    location_room: Optional[str] = None
    manufacturer: Optional[str] = None
    ip_address: Optional[str] = None
    specifications: Optional[dict[str, Any]] = None
    attachments: Optional[List[str]] = None


class EquipmentOut(EquipmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    model_id: Optional[UUID] = None  # ID модели из справочника
    
    # Дополнительные поля для детального просмотра
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    room_name: Optional[str] = None
    building_name: Optional[str] = None
    model_name: Optional[str] = None
    brand_name: Optional[str] = None
    type_name: Optional[str] = None