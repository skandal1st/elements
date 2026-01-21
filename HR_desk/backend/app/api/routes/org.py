from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.department import Department
from app.models.employee import Employee
from app.models.position import Position
from app.schemas.org import OrgDepartment, OrgEmployee, OrgPosition


router = APIRouter(prefix="/org", tags=["org"])


@router.get("/", response_model=List[OrgDepartment], dependencies=[Depends(require_roles(["hr", "it", "manager", "auditor"]))])
def get_org_structure(db: Session = Depends(get_db)) -> List[OrgDepartment]:
    departments = db.query(Department).all()
    positions = {pos.id: pos for pos in db.query(Position).all()}
    employees = db.query(Employee).all()

    employees_by_department: dict[int, list[Employee]] = {}
    for employee in employees:
        if employee.department_id is None:
            continue
        employees_by_department.setdefault(employee.department_id, []).append(employee)

    result: list[OrgDepartment] = []
    for department in departments:
        dept_employees = employees_by_department.get(department.id, [])
        position_groups: dict[int | None, list[Employee]] = {}
        for employee in dept_employees:
            position_groups.setdefault(employee.position_id, []).append(employee)

        positions_out: list[OrgPosition] = []
        for position_id, group in position_groups.items():
            position_name = positions.get(position_id).name if position_id in positions else "Без должности"
            positions_out.append(
                OrgPosition(
                    id=position_id,
                    name=position_name,
                    employees=[OrgEmployee(id=e.id, full_name=e.full_name) for e in group],
                )
            )

        result.append(
            OrgDepartment(
                id=department.id,
                name=department.name,
                parent_department_id=department.parent_department_id,
                positions=positions_out,
            )
        )

    return result
