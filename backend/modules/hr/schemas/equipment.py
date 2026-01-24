from typing import Optional

from pydantic import BaseModel


class EquipmentBase(BaseModel):
    type: str
    serial_number: str
    status: str = "in_use"
    employee_id: Optional[int] = None


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    status: Optional[str] = None
    employee_id: Optional[int] = None


class EquipmentOut(EquipmentBase):
    id: int

    class Config:
        from_attributes = True
