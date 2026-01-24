"""
Схемы для расходных материалов
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ConsumableBase(BaseModel):
    name: str
    model: Optional[str] = None
    category: Optional[str] = None
    consumable_type: Optional[str] = None  # cartridge, drum, toner, ink, paper, other
    unit: str = "шт"
    quantity_in_stock: int = 0
    min_quantity: int = 0
    cost_per_unit: Optional[Decimal] = None
    supplier: Optional[str] = None
    last_purchase_date: Optional[date] = None


class ConsumableCreate(ConsumableBase):
    pass


class ConsumableUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    category: Optional[str] = None
    consumable_type: Optional[str] = None
    unit: Optional[str] = None
    quantity_in_stock: Optional[int] = None
    min_quantity: Optional[int] = None
    cost_per_unit: Optional[Decimal] = None
    supplier: Optional[str] = None
    last_purchase_date: Optional[date] = None


class ConsumableOut(ConsumableBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConsumableIssueBase(BaseModel):
    consumable_id: UUID
    quantity: int
    issued_to_id: UUID
    reason: Optional[str] = None


class ConsumableIssueCreate(ConsumableIssueBase):
    pass


class ConsumableIssueOut(ConsumableIssueBase):
    id: UUID
    issued_by_id: UUID
    created_at: datetime

    # Дополнительные поля из JOIN
    consumable_name: Optional[str] = None
    consumable_unit: Optional[str] = None
    issued_to_name: Optional[str] = None
    issued_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Схемы для поставок расходных материалов
class ConsumableSupplyBase(BaseModel):
    consumable_id: UUID
    quantity: int
    cost: Optional[Decimal] = None  # Общая стоимость поставки
    supplier: Optional[str] = None  # Поставщик
    invoice_number: Optional[str] = None  # Номер накладной
    supply_date: Optional[date] = None  # Дата поставки
    notes: Optional[str] = None  # Примечания


class ConsumableSupplyCreate(ConsumableSupplyBase):
    pass


class ConsumableSupplyOut(ConsumableSupplyBase):
    id: UUID
    created_by_id: UUID
    created_at: datetime

    # Дополнительные поля из JOIN
    consumable_name: Optional[str] = None
    consumable_unit: Optional[str] = None
    created_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
