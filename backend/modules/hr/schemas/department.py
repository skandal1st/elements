from typing import Optional

from pydantic import BaseModel


class DepartmentBase(BaseModel):
    name: str
    parent_department_id: Optional[int] = None
    manager_id: Optional[int] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    parent_department_id: Optional[int] = None
    manager_id: Optional[int] = None


class DepartmentOut(DepartmentBase):
    id: int

    class Config:
        from_attributes = True
