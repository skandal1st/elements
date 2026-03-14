"""Схемы для справочников: Funding, CostCode, Subunit."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FundingBase(BaseModel):
    name: str
    is_active: bool = True


class FundingCreate(FundingBase):
    pass


class FundingOut(FundingBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    legacy_num: int | None = None
    created_at: datetime | None = None


class CostCodeBase(BaseModel):
    name: str
    is_active: bool = True


class CostCodeCreate(CostCodeBase):
    pass


class CostCodeOut(CostCodeBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    legacy_num: int | None = None
    created_at: datetime | None = None


class SubunitBase(BaseModel):
    name: str
    is_active: bool = True


class SubunitCreate(SubunitBase):
    pass


class SubunitOut(SubunitBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    legacy_id: int | None = None
    created_at: datetime | None = None
