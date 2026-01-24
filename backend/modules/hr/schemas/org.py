from typing import List, Optional

from pydantic import BaseModel


class OrgEmployee(BaseModel):
    id: int
    full_name: str

    class Config:
        from_attributes = True


class OrgPosition(BaseModel):
    id: Optional[int]
    name: str
    employees: List[OrgEmployee]


class OrgDepartment(BaseModel):
    id: int
    name: str
    parent_department_id: Optional[int] = None
    positions: List[OrgPosition]
