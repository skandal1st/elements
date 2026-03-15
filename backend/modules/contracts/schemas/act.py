from datetime import date, datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from .file_schema import ContractFileOut


class ContractActBase(BaseModel):
    doctype: int = 0  # 0=акт, 1=П/П, 2=корректировка
    number: str | None = None
    act_date: date | None = None
    notice: str | None = None
    amount: Decimal = Decimal("0")


class ContractActCreate(ContractActBase):
    """Тело запроса на создание акта. contract_id берётся из path /contracts/{contract_id}/acts/."""
    contract_id: UUID | None = None  # не передаётся с фронта, подставляется из URL


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
    files: List[ContractFileOut] = []
