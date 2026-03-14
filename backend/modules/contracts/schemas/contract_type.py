from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ContractTypeBase(BaseModel):
    name: str
    is_active: bool = True


class ContractTypeCreate(ContractTypeBase):
    pass


class ContractTypeUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class ContractTypeOut(ContractTypeBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    legacy_num: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
