"""
Схемы для лицензий ПО
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SoftwareLicenseBase(BaseModel):
    software_name: str
    vendor: Optional[str] = None
    license_type: Optional[str] = None  # perpetual, subscription, trial, etc.
    license_key: Optional[str] = None
    total_licenses: int = 1
    expires_at: Optional[date] = None
    cost: Optional[Decimal] = None
    purchase_date: Optional[date] = None
    notes: Optional[str] = None


class SoftwareLicenseCreate(SoftwareLicenseBase):
    pass


class SoftwareLicenseUpdate(BaseModel):
    software_name: Optional[str] = None
    vendor: Optional[str] = None
    license_type: Optional[str] = None
    license_key: Optional[str] = None
    total_licenses: Optional[int] = None
    expires_at: Optional[date] = None
    cost: Optional[Decimal] = None
    purchase_date: Optional[date] = None
    notes: Optional[str] = None


class LicenseAssignmentBase(BaseModel):
    license_id: UUID
    user_id: Optional[UUID] = None
    equipment_id: Optional[UUID] = None
    is_saas: bool = False  # SaaS/облачный сервис - без привязки к оборудованию


class LicenseAssignmentCreate(LicenseAssignmentBase):
    pass


class LicenseAssignmentOut(LicenseAssignmentBase):
    id: UUID
    assigned_at: datetime
    released_at: Optional[datetime] = None
    
    # Дополнительные поля из JOIN
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    equipment_name: Optional[str] = None
    equipment_inventory: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class SoftwareLicenseOut(SoftwareLicenseBase):
    id: UUID
    used_licenses: int
    created_at: datetime
    updated_at: datetime
    available_licenses: Optional[int] = None  # Вычисляемое поле
    assignments: Optional[List[LicenseAssignmentOut]] = None
    
    model_config = ConfigDict(from_attributes=True)
