from datetime import date
from typing import Optional

from pydantic import BaseModel


class HRRequestBase(BaseModel):
    type: str
    employee_id: int
    request_date: date
    effective_date: Optional[date] = None
    status: str = "new"
    needs_it_equipment: bool = False
    pass_number: Optional[str] = None


class HRRequestCreate(HRRequestBase):
    pass


class HRRequestUpdate(BaseModel):
    status: Optional[str] = None
    effective_date: Optional[date] = None


class HRRequestOut(HRRequestBase):
    id: int

    class Config:
        from_attributes = True
