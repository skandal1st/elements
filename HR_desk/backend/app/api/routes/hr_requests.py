from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.department import Department
from app.models.employee import Employee
from app.models.hr_request import HRRequest
from app.models.position import Position
from app.models.user import User
from app.schemas.hr_request import HRRequestCreate, HRRequestOut
from app.services.audit import log_action
from app.services.hr_requests import process_hr_request
from app.services.integrations import create_supporit_ticket, fetch_equipment_for_employee
from app.utils.naming import generate_corporate_email


router = APIRouter(prefix="/hr-requests", tags=["hr-requests"])


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
        
        # Получаем название отдела и должности
        department_name = None
        position_name = None
        if employee.department_id:
            dept = db.query(Department).filter(Department.id == employee.department_id).first()
            if dept:
                department_name = dept.name
        if employee.position_id:
            pos = db.query(Position).filter(Position.id == employee.position_id).first()
            if pos:
                position_name = pos.name
        
        description = (
            "HR: провести онбординг сотрудника.\n"
            f"ФИО: {employee.full_name}\n"
            f"Email: {email}\n"
            f"Отдел: {department_name or 'Не указан'}\n"
            f"Должность: {position_name or 'Не указана'}\n"
            f"Дата выхода: {request.effective_date}\n"
        )
        create_supporit_ticket(
            title=f"Онбординг: {employee.full_name}",
            description=description,
            category="hr",
        )
    if request.type == "fire":
        # Получаем название отдела и должности
        department_name = None
        position_name = None
        if employee.department_id:
            dept = db.query(Department).filter(Department.id == employee.department_id).first()
            if dept:
                department_name = dept.name
        if employee.position_id:
            pos = db.query(Position).filter(Position.id == employee.position_id).first()
            if pos:
                position_name = pos.name
        
        equipment = fetch_equipment_for_employee(employee.id, employee.email)
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
        create_supporit_ticket(
            title=f"Увольнение: {employee.full_name}",
            description=description,
            category="hr",
        )
    log_action(db, user.username, "create", "hr_request", f"id={request.id}")
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
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    log_action(db, user.username, "process", "hr_request", f"id={request.id}")
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
