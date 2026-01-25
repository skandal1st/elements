"""Роуты /hr/hr-requests."""
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.hr.dependencies import get_db, get_current_user, require_roles
from backend.modules.hr.models.department import Department
from backend.modules.hr.models.employee import Employee
from backend.modules.hr.models.hr_request import HRRequest
from backend.modules.hr.models.position import Position
from backend.modules.hr.models.user import User
from backend.modules.hr.schemas.hr_request import HRRequestCreate, HRRequestOut
from backend.modules.hr.services.audit import log_action
from backend.modules.hr.services.hr_requests import process_hr_request
from backend.modules.hr.services.integrations import create_it_ticket, fetch_equipment_for_employee
from backend.modules.hr.utils.naming import generate_corporate_email

router = APIRouter(prefix="/hr-requests", tags=["hr-requests"])


def _audit_user(user: User) -> str:
    return user.username or user.email


def _dept_name(db: Session, department_id: int | None) -> str | None:
    if not department_id:
        return None
    d = db.query(Department).filter(Department.id == department_id).first()
    return d.name if d else None


def _pos_name(db: Session, position_id: int | None) -> str | None:
    if not position_id:
        return None
    p = db.query(Position).filter(Position.id == position_id).first()
    return p.name if p else None


@router.get("/", response_model=List[HRRequestOut], dependencies=[Depends(require_roles(["hr", "it", "auditor"]))])
def list_requests(db: Session = Depends(get_db)) -> List[HRRequest]:
    return db.query(HRRequest).all()


@router.post("/", response_model=HRRequestOut, dependencies=[Depends(require_roles(["hr"]))])
def create_request(
    payload: HRRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HRRequest:
    employee = db.query(Employee).filter(Employee.id == payload.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    request = HRRequest(**payload.model_dump())
    db.add(request)
    db.commit()
    db.refresh(request)

    if request.type == "hire" and request.needs_it_equipment:
        email = generate_corporate_email(employee.full_name)
        department_name = _dept_name(db, employee.department_id)
        position_name = _pos_name(db, employee.position_id)
        description = (
            "HR: провести онбординг сотрудника.\n"
            f"ФИО: {employee.full_name}\n"
            f"Email: {email}\n"
            f"Отдел: {department_name or 'Не указан'}\n"
            f"Должность: {position_name or 'Не указана'}\n"
            f"Дата выхода: {request.effective_date}\n"
        )
        create_it_ticket(
            db=db,
            title=f"Онбординг: {employee.full_name}",
            description=description,
            category="hr",
        )

    if request.type == "fire":
        department_name = _dept_name(db, employee.department_id)
        position_name = _pos_name(db, employee.position_id)
        equipment = fetch_equipment_for_employee(db, employee.id, employee.email)
        equipment_lines = "\n".join(
            f"- {item.get('name') or item.get('type')} ({item.get('inventory_number') or item.get('serial_number')})"
            for item in equipment
        )
        description = (
            "HR: увольнение сотрудника.\n"
            f"ФИО: {employee.full_name}\n"
            f"Email: {employee.email or 'Не указан'}\n"
            f"Отдел: {department_name or 'Не указан'}\n"
            f"Должность: {position_name or 'Не указана'}\n"
            f"Дата увольнения: {request.effective_date}\n"
            f"Оборудование:\n{equipment_lines or 'Нет данных'}"
        )
        create_it_ticket(
            db=db,
            title=f"Увольнение: {employee.full_name}",
            description=description,
            category="hr",
        )

    log_action(db, _audit_user(user), "create", "hr_request", f"id={request.id}")
    return request


@router.post("/{request_id}/process", response_model=HRRequestOut, dependencies=[Depends(require_roles(["it"]))])
def process_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HRRequest:
    request = db.query(HRRequest).filter(HRRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    employee = db.query(Employee).filter(Employee.id == request.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    try:
        request = process_hr_request(db, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    log_action(db, _audit_user(user), "process", "hr_request", f"id={request.id}")
    return request


@router.post("/process-due", dependencies=[Depends(require_roles(["it"]))])
def process_due_requests(db: Session = Depends(get_db)) -> dict:
    today = date.today()
    requests = (
        db.query(HRRequest)
        .filter(HRRequest.status != "done")
        .filter(HRRequest.effective_date.isnot(None))
        .filter(HRRequest.effective_date <= today)
        .all()
    )
    processed = 0
    for req in requests:
        process_hr_request(db, req)
        processed += 1
    return {"processed": processed}
