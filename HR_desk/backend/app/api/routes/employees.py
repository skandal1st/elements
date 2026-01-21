from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.employee import Employee
from app.models.user import User
from app.schemas.employee import EmployeeCreate, EmployeeOut, EmployeeUpdate
from app.services.audit import log_action


router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/", response_model=List[EmployeeOut], dependencies=[Depends(require_roles(["hr", "it", "manager", "auditor"]))])
def list_employees(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
) -> List[Employee]:
    query = db.query(Employee)
    if q:
        query = query.filter(Employee.full_name.ilike(f"%{q}%"))
    if department_id:
        query = query.filter(Employee.department_id == department_id)
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
    log_action(db, user.username, "create", "employee", f"id={employee.id}")
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
    log_action(db, user.username, "update", "employee", f"id={employee.id}")
    return employee
