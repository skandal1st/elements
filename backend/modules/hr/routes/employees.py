"""Роуты /hr/employees."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.modules.hr.dependencies import get_db, get_current_user, require_roles
from backend.modules.hr.models.department import Department
from backend.modules.hr.models.employee import Employee
from backend.modules.hr.models.user import User
from backend.modules.hr.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from backend.modules.hr.services.audit import log_action

router = APIRouter(prefix="/employees", tags=["employees"])


def _audit_user(user: User) -> str:
    return user.username or user.email


@router.get("/", response_model=List[EmployeeOut], dependencies=[Depends(require_roles(["hr", "it", "manager", "auditor"]))])
def list_employees(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
    include_dismissed: bool = Query(default=False),
) -> List[Employee]:
    query = db.query(Employee)
    if q:
        qq = q.strip()
        if qq:
            like = f"%{qq}%"
            query = query.filter(
                or_(
                    Employee.full_name.ilike(like),
                    Employee.email.ilike(like),
                    Employee.internal_phone.ilike(like),
                    Employee.external_phone.ilike(like),
                    Employee.external_id.ilike(like),
                    Employee.pass_number.ilike(like),
                )
            )
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    if not include_dismissed:
        query = query.filter(Employee.status != "dismissed")
    return query.all()


@router.post("/", response_model=EmployeeOut, dependencies=[Depends(require_roles(["hr"]))])
def create_employee(
    payload: EmployeeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Employee:
    employee = Employee(**payload.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    log_action(db, _audit_user(user), "create", "employee", f"id={employee.id}")
    return employee


@router.patch("/{employee_id}", response_model=EmployeeOut, dependencies=[Depends(require_roles(["hr"]))])
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Employee:
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)
    db.commit()
    db.refresh(employee)
    log_action(db, _audit_user(user), "update", "employee", f"id={employee.id}")
    return employee


@router.delete("/{employee_id}", dependencies=[Depends(require_roles(["hr"]))])
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """
    "Удаление" сотрудника.

    В системе много связей на employees (HR заявки, IT аккаунты, оборудование),
    поэтому делаем безопасный soft-delete: переводим в статус dismissed и
    чистим ссылки manager_id у подчинённых, а также manager_id в departments.
    """
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    # Отвязываем как руководителя в отделах
    db.query(Department).filter(Department.manager_id == employee_id).update(
        {"manager_id": None}
    )
    # Отвязываем как руководителя у других сотрудников
    db.query(Employee).filter(Employee.manager_id == employee_id).update(
        {"manager_id": None}
    )

    employee.status = "dismissed"
    db.commit()

    log_action(db, _audit_user(user), "delete", "employee", f"id={employee.id}")
    return {"detail": "Сотрудник помечен как dismissed"}


@router.get(
    "/{employee_id}/card",
    dependencies=[Depends(require_roles(["hr", "it", "manager"]))],
)
def get_employee_card(
    employee_id: int,
    db: Session = Depends(get_db),
) -> dict:
    """Получить карточку сотрудника с расширенной информацией"""
    from backend.modules.hr.models.position import Position
    from backend.modules.it.models import Room, Building

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")

    position_name = None
    if employee.position_id:
        position = db.query(Position).filter(Position.id == employee.position_id).first()
        if position:
            position_name = position.name

    department_name = None
    if employee.department_id:
        department = db.query(Department).filter(Department.id == employee.department_id).first()
        if department:
            department_name = department.name

    room_name = None
    building_name = None
    if employee.room_id:
        room = db.query(Room).filter(Room.id == employee.room_id).first()
        if room:
            room_name = room.name
            if room.building_id:
                building = db.query(Building).filter(Building.id == room.building_id).first()
                if building:
                    building_name = building.name

    return {
        "id": employee.id,
        "full_name": employee.full_name,
        "position_name": position_name,
        "department_name": department_name,
        "room_name": room_name,
        "room_id": str(employee.room_id) if employee.room_id else None,
        "building_name": building_name,
        "internal_phone": employee.internal_phone,
        "external_phone": employee.external_phone,
        "email": employee.email,
    }
