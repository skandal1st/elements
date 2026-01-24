"""
Схемы для заявок на оборудование
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EquipmentRequestBase(BaseModel):
    title: str
    description: Optional[str] = None
    equipment_category: str
    request_type: str = "new"  # new, replacement, upgrade
    quantity: int = 1
    urgency: str = "normal"  # low, normal, high, critical
    justification: Optional[str] = None
    replace_equipment_id: Optional[UUID] = None
    estimated_cost: Optional[Decimal] = None


class EquipmentRequestCreate(EquipmentRequestBase):
    pass


class EquipmentRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    equipment_category: Optional[str] = None
    request_type: Optional[str] = None
    quantity: Optional[int] = None
    urgency: Optional[str] = None
    justification: Optional[str] = None
    replace_equipment_id: Optional[UUID] = None
    estimated_cost: Optional[Decimal] = None
    # Только для IT/Admin
    status: Optional[str] = None
    issued_equipment_id: Optional[UUID] = None
    ordered_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    issued_at: Optional[datetime] = None


class ReviewRequest(BaseModel):
    status: str  # approved, rejected
    comment: Optional[str] = None
    estimated_cost: Optional[Decimal] = None


class EquipmentRequestOut(EquipmentRequestBase):
    id: UUID
    status: str
    requester_id: UUID
    reviewer_id: Optional[UUID] = None
    issued_equipment_id: Optional[UUID] = None
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    ordered_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    issued_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # Дополнительные поля из JOIN
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    requester_department: Optional[str] = None
    reviewer_name: Optional[str] = None
    replace_equipment_name: Optional[str] = None
    replace_equipment_inventory: Optional[str] = None
    issued_equipment_name: Optional[str] = None
    issued_equipment_inventory: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
