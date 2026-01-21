from typing import Optional

from pydantic import BaseModel


class PositionBase(BaseModel):
    name: str
    access_template: Optional[str] = None
    department_id: Optional[int] = None


class PositionCreate(PositionBase):
    pass


class PositionUpdate(BaseModel):
    name: Optional[str] = None
    access_template: Optional[str] = None
    department_id: Optional[int] = None


class PositionOut(PositionBase):
    id: int

    class Config:
        from_attributes = True
