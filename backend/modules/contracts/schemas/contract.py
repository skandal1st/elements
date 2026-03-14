from datetime import date, datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from .act import ContractActOut


class ContractBase(BaseModel):
    contract_type_id: UUID | None = None
    counterparty_id: UUID | None = None
    funding_id: UUID | None = None
    cost_code_id: UUID | None = None
    subunit_id: UUID | None = None
    number: str
    date_begin: date | None = None
    date_end: date | None = None
    name: str
    full_name: str | None = None
    inv_num: str | None = None
    comment: str | None = None
    sum_amount: Decimal = Decimal("0")
    notice: str | None = None
    term: date | None = None
    done: bool = False


class ContractCreate(ContractBase):
    document_id: UUID | None = None


class ContractUpdate(BaseModel):
    contract_type_id: UUID | None = None
    counterparty_id: UUID | None = None
    funding_id: UUID | None = None
    cost_code_id: UUID | None = None
    subunit_id: UUID | None = None
    number: str | None = None
    date_begin: date | None = None
    date_end: date | None = None
    name: str | None = None
    full_name: str | None = None
    inv_num: str | None = None
    comment: str | None = None
    sum_amount: Decimal | None = None
    notice: str | None = None
    term: date | None = None
    done: bool | None = None


class ContractFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: str
    file_path: str
    file_name: str
    created_at: datetime | None


class ContractListOut(BaseModel):
    """Список договоров с агрегатами (выполнено по актам, оплачено по П/П, остатки)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID | None
    legacy_num: int | None
    contract_type_id: UUID | None
    counterparty_id: UUID | None
    number: str
    date_begin: date | None
    date_end: date | None
    name: str
    sum_amount: Decimal
    term: date | None
    done: bool
    created_at: datetime | None
    updated_at: datetime | None
    # Агрегаты
    sum_acts: Decimal = Decimal("0")   # выполнено по актам
    sum_pp: Decimal = Decimal("0")       # оплачено по П/П
    rest_acts: Decimal = Decimal("0")    # остаток выполнить
    rest_pp: Decimal = Decimal("0")     # остаток оплатить
    # Имена для отображения
    counterparty_name: str | None = None
    contract_type_name: str | None = None
    funding_name: str | None = None
    subunit_name: str | None = None


class ContractDetailOut(ContractListOut):
    full_name: str | None = None
    inv_num: str | None = None
    comment: str | None = None
    notice: str | None = None
    funding_id: UUID | None = None
    cost_code_id: UUID | None = None
    subunit_id: UUID | None = None
    created_by_id: UUID | None = None
    acts: List[ContractActOut] = []
    files: List[ContractFileOut] = []
