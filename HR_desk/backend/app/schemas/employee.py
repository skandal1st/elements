from datetime import date
from typing import Optional

from pydantic import BaseModel


class EmployeeBase(BaseModel):
    full_name: str
    position_id: Optional[int] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    internal_phone: Optional[str] = None
    external_phone: Optional[str] = None
    email: Optional[str] = None
    birthday: Optional[date] = None
    status: str = "candidate"
    uses_it_equipment: bool = False
    external_id: Optional[str] = None
    pass_number: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    position_id: Optional[int] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    internal_phone: Optional[str] = None
    external_phone: Optional[str] = None
    email: Optional[str] = None
    birthday: Optional[date] = None
    status: Optional[str] = None
    uses_it_equipment: Optional[bool] = None
    external_id: Optional[str] = None
    pass_number: Optional[str] = None


class EmployeeOut(EmployeeBase):
    id: int

    class Config:
        from_attributes = True
