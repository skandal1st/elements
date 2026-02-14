"""Роуты /hr/org — оргструктура."""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.modules.hr.dependencies import get_db, require_roles
from backend.modules.hr.models.department import Department
from backend.modules.hr.models.employee import Employee
from backend.modules.hr.models.position import Position
from backend.modules.hr.schemas.org import OrgDepartment, OrgEmployee, OrgPosition

router = APIRouter(prefix="/org", tags=["org"])


@router.get("/", response_model=List[OrgDepartment], dependencies=[Depends(require_roles(["hr", "it", "manager", "auditor"]))])
def get_org_structure(db: Session = Depends(get_db)) -> List[OrgDepartment]:
    departments = db.query(Department).all()
    positions = {p.id: p for p in db.query(Position).all()}
    employees = db.query(Employee).filter(Employee.status != "dismissed").all()

    # Сотрудники без отдела — группируем в виртуальный отдел «Без отдела»
    employees_by_department: dict[int, list[Employee]] = {}
    no_department_employees: list[Employee] = []
    for e in employees:
        if e.department_id is None:
            no_department_employees.append(e)
            continue
        employees_by_department.setdefault(e.department_id, []).append(e)

    result: list[OrgDepartment] = []
    for dept in departments:
        dept_employees = employees_by_department.get(dept.id, [])
        position_groups: dict[int | None, list[Employee]] = {}
        for e in dept_employees:
            position_groups.setdefault(e.position_id, []).append(e)

        positions_out: list[OrgPosition] = []
        for pos_id, group in position_groups.items():
            p = positions.get(pos_id)
            pos_name = p.name if p else "Без должности"
            positions_out.append(
                OrgPosition(
                    id=pos_id,
                    name=pos_name,
                    employees=[OrgEmployee(id=e.id, full_name=e.full_name) for e in group],
                )
            )
        result.append(
            OrgDepartment(
                id=dept.id,
                name=dept.name,
                parent_department_id=dept.parent_department_id,
                positions=positions_out,
            )
        )

    # Добавляем сотрудников без отдела (если есть)
    if no_department_employees:
        no_dept_positions: dict[int | None, list[Employee]] = {}
        for e in no_department_employees:
            no_dept_positions.setdefault(e.position_id, []).append(e)

        no_dept_pos_out: list[OrgPosition] = []
        for pos_id, group in no_dept_positions.items():
            p = positions.get(pos_id)
            pos_name = p.name if p else "Без должности"
            no_dept_pos_out.append(
                OrgPosition(
                    id=pos_id,
                    name=pos_name,
                    employees=[OrgEmployee(id=e.id, full_name=e.full_name) for e in group],
                )
            )
        result.append(
            OrgDepartment(
                id=0,
                name="Без отдела",
                parent_department_id=None,
                positions=no_dept_pos_out,
            )
        )

    return result
