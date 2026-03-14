from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CounterpartyBase(BaseModel):
    name: str
    full_name: str | None = None
    inn: str | None = None
    kpp: str | None = None
    address: str | None = None
    is_active: bool = True


class CounterpartyCreate(CounterpartyBase):
    pass


class CounterpartyUpdate(BaseModel):
    name: str | None = None
    full_name: str | None = None
    inn: str | None = None
    kpp: str | None = None
    address: str | None = None
    is_active: bool | None = None


class CounterpartyOut(CounterpartyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    legacy_num: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
