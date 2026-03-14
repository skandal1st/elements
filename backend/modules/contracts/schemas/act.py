from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ContractActBase(BaseModel):
    doctype: int = 0  # 0=акт, 1=П/П, 2=корректировка
    number: str | None = None
    act_date: date | None = None
    notice: str | None = None
    amount: Decimal = Decimal("0")


class ContractActCreate(ContractActBase):
    contract_id: UUID


class ContractActUpdate(BaseModel):
    doctype: int | None = None
    number: str | None = None
    act_date: date | None = None
    notice: str | None = None
    amount: Decimal | None = None


class ContractActOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    legacy_num: int | None
    doctype: int
    number: str | None
    act_date: date | None
    notice: str | None
    amount: Decimal
    created_at: datetime | None
    updated_at: datetime | None
