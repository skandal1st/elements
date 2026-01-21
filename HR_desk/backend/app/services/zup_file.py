"""
Сервис интеграции с 1С ЗУП через JSON файлы.

Поддерживает:
- Загрузку JSON файла через API
- Чтение JSON из директории (для обмена через сетевую папку)
"""

import json
import os
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.employee import Employee
from app.models.hr_request import HRRequest
from app.models.position import Position
from app.services.integrations import create_supporit_ticket
from app.utils.naming import generate_corporate_email


@dataclass
class ImportResult:
    """Результат импорта из JSON"""
    departments_created: int = 0
    departments_updated: int = 0
    positions_created: int = 0
    positions_updated: int = 0
    employees_created: int = 0
    employees_updated: int = 0
    hire_requests_created: int = 0
    fire_requests_created: int = 0
    errors: list = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []


def parse_date(date_str: Optional[str]) -> Optional[date]:
    """Парсит дату из различных форматов"""
    if not date_str:
        return None
    
    # Убираем время если есть
    date_str = str(date_str).split("T")[0].split(" ")[0]
    
    # Пробуем разные форматы
    formats = ["%Y-%m-%d", "%d.%m.%Y", "%Y%m%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    
    return None


def import_departments(db: Session, departments_data: list, result: ImportResult) -> dict:
    """
    Импортирует отделы из JSON.
    Возвращает маппинг external_id -> internal_id
    """
    ext_to_int = {}
    
    # Первый проход - создаём/обновляем без родителей
    for dept in departments_data:
        try:
            ext_id = str(dept.get("id") or dept.get("external_id") or dept.get("Ref_Key") or "")
            name = dept.get("name") or dept.get("Наименование") or dept.get("Description") or ""
            
            if not ext_id or not name:
                continue
            
            department = db.query(Department).filter(
                Department.external_id == ext_id
            ).first()
            
            if department:
                department.name = name
                result.departments_updated += 1
            else:
                department = Department(name=name, external_id=ext_id)
                db.add(department)
                db.flush()
                result.departments_created += 1
            
            ext_to_int[ext_id] = department.id
            
        except Exception as e:
            result.errors.append(f"Отдел: {e}")
    
    db.commit()
    
    # Второй проход - устанавливаем родителей
    for dept in departments_data:
        ext_id = str(dept.get("id") or dept.get("external_id") or dept.get("Ref_Key") or "")
        parent_ext_id = str(dept.get("parent_id") or dept.get("Родитель_Key") or dept.get("parent_external_id") or "")
        
        if ext_id and parent_ext_id and parent_ext_id in ext_to_int:
            department = db.query(Department).filter(
                Department.external_id == ext_id
            ).first()
            if department:
                department.parent_department_id = ext_to_int[parent_ext_id]
    
    db.commit()
    return ext_to_int


def import_positions(db: Session, positions_data: list, dept_mapping: dict, result: ImportResult) -> dict:
    """
    Импортирует должности из JSON.
    Возвращает маппинг external_id -> internal_id
    """
    ext_to_int = {}
    
    for pos in positions_data:
        try:
            ext_id = str(pos.get("id") or pos.get("external_id") or pos.get("Ref_Key") or "")
            name = pos.get("name") or pos.get("Наименование") or pos.get("Description") or ""
            
            if not ext_id or not name:
                continue
            
            # Привязка к отделу (опционально)
            dept_ext_id = str(pos.get("department_id") or pos.get("Подразделение_Key") or "")
            department_id = dept_mapping.get(dept_ext_id) if dept_ext_id else None
            
            position = db.query(Position).filter(
                Position.external_id == ext_id
            ).first()
            
            if position:
                position.name = name
                position.department_id = department_id
                result.positions_updated += 1
            else:
                position = Position(
                    name=name,
                    external_id=ext_id,
                    department_id=department_id,
                )
                db.add(position)
                db.flush()
                result.positions_created += 1
            
            ext_to_int[ext_id] = position.id
            
        except Exception as e:
            result.errors.append(f"Должность: {e}")
    
    db.commit()
    return ext_to_int


def import_employees(
    db: Session,
    employees_data: list,
    dept_mapping: dict,
    pos_mapping: dict,
    result: ImportResult,
    create_hr_requests: bool = False,
) -> None:
    """Импортирует сотрудников из JSON"""
    
    for emp in employees_data:
        try:
            ext_id = str(emp.get("id") or emp.get("external_id") or emp.get("Ref_Key") or "")
            full_name = (
                emp.get("full_name") or 
                emp.get("ФИО") or 
                emp.get("Наименование") or 
                emp.get("Description") or 
                emp.get("name") or
                ""
            )
            
            if not ext_id or not full_name:
                continue
            
            # Парсим данные
            birthday = parse_date(emp.get("birthday") or emp.get("ДатаРождения"))
            phone = emp.get("phone") or emp.get("Телефон") or emp.get("internal_phone")
            email = emp.get("email") or emp.get("Email")
            
            # Отдел
            dept_ext_id = str(emp.get("department_id") or emp.get("Подразделение_Key") or "")
            department_id = dept_mapping.get(dept_ext_id) if dept_ext_id else None
            
            # Если передано имя отдела вместо ID
            if not department_id:
                dept_name = emp.get("department") or emp.get("Подразделение")
                if dept_name:
                    dept = db.query(Department).filter(Department.name == dept_name).first()
                    if dept:
                        department_id = dept.id
            
            # Должность
            pos_ext_id = str(emp.get("position_id") or emp.get("Должность_Key") or "")
            position_id = pos_mapping.get(pos_ext_id) if pos_ext_id else None
            
            # Если передано имя должности вместо ID
            if not position_id:
                pos_name = emp.get("position") or emp.get("Должность")
                if pos_name:
                    pos = db.query(Position).filter(Position.name == pos_name).first()
                    if pos:
                        position_id = pos.id
            
            # Статус
            is_dismissed = emp.get("dismissed") or emp.get("Уволен") or False
            is_new_hire = emp.get("new_hire") or emp.get("НовыйПрием") or False
            status = "dismissed" if is_dismissed else "active"
            
            # Ищем сотрудника
            employee = db.query(Employee).filter(
                Employee.external_id == ext_id
            ).first()
            
            was_dismissed = employee.status == "dismissed" if employee else False
            was_active = employee.status == "active" if employee else False
            
            if employee:
                # Обновляем
                employee.full_name = full_name
                employee.birthday = birthday or employee.birthday
                employee.internal_phone = phone or employee.internal_phone
                employee.email = email or employee.email
                employee.department_id = department_id or employee.department_id
                employee.position_id = position_id or employee.position_id
                employee.status = status
                result.employees_updated += 1
            else:
                # Создаём
                employee = Employee(
                    full_name=full_name,
                    external_id=ext_id,
                    birthday=birthday,
                    internal_phone=phone,
                    email=email,
                    department_id=department_id,
                    position_id=position_id,
                    status="candidate" if is_new_hire else status,
                )
                db.add(employee)
                db.flush()
                result.employees_created += 1
            
            # Создаём HR-заявки если нужно
            if create_hr_requests:
                effective_date = parse_date(
                    emp.get("effective_date") or 
                    emp.get("hire_date") or 
                    emp.get("fire_date") or
                    emp.get("ДатаПриема") or
                    emp.get("ДатаУвольнения")
                )
                
                # Приём на работу
                if is_new_hire or (not was_active and status == "active"):
                    _create_hire_request(db, employee, effective_date, result)
                
                # Увольнение
                if is_dismissed and not was_dismissed:
                    _create_fire_request(db, employee, effective_date, result)
            
        except Exception as e:
            result.errors.append(f"Сотрудник {full_name}: {e}")
    
    db.commit()


def _create_hire_request(
    db: Session,
    employee: Employee,
    effective_date: Optional[date],
    result: ImportResult,
) -> None:
    """Создаёт HR-заявку на приём и тикет в SupporIT"""
    
    hr_request = HRRequest(
        employee_id=employee.id,
        type="hire",
        status="pending",
        request_date=date.today(),
        effective_date=effective_date or date.today(),
        needs_it_equipment=True,
    )
    db.add(hr_request)
    db.flush()
    result.hire_requests_created += 1
    
    # Тикет в SupporIT
    email = generate_corporate_email(employee.full_name)
    dept_name = employee.department.name if employee.department else "Не указан"
    pos_name = employee.position.name if employee.position else "Не указана"
    
    description = (
        f"HR: Приём на работу (из 1С ЗУП)\n\n"
        f"ФИО: {employee.full_name}\n"
        f"Email: {email}\n"
        f"Отдел: {dept_name}\n"
        f"Должность: {pos_name}\n"
        f"Дата выхода: {effective_date or 'Не указана'}\n"
    )
    
    create_supporit_ticket(
        title=f"Онбординг: {employee.full_name}",
        description=description,
        category="other",
    )


def _create_fire_request(
    db: Session,
    employee: Employee,
    effective_date: Optional[date],
    result: ImportResult,
) -> None:
    """Создаёт HR-заявку на увольнение и тикет в SupporIT"""
    
    hr_request = HRRequest(
        employee_id=employee.id,
        type="fire",
        status="pending",
        request_date=date.today(),
        effective_date=effective_date or date.today(),
    )
    db.add(hr_request)
    db.flush()
    result.fire_requests_created += 1
    
    # Тикет в SupporIT
    dept_name = employee.department.name if employee.department else "Не указан"
    pos_name = employee.position.name if employee.position else "Не указана"
    
    description = (
        f"HR: Увольнение сотрудника (из 1С ЗУП)\n\n"
        f"ФИО: {employee.full_name}\n"
        f"Email: {employee.email or 'Не указан'}\n"
        f"Отдел: {dept_name}\n"
        f"Должность: {pos_name}\n"
        f"Дата увольнения: {effective_date or 'Не указана'}\n\n"
        f"Необходимо:\n"
        f"- Заблокировать учётные записи\n"
        f"- Принять оборудование\n"
    )
    
    create_supporit_ticket(
        title=f"Увольнение: {employee.full_name}",
        description=description,
        category="other",
    )


def import_from_json(
    db: Session,
    data: dict,
    create_hr_requests: bool = False,
) -> ImportResult:
    """
    Импортирует данные из JSON.
    
    Ожидаемый формат:
    {
        "departments": [...],
        "positions": [...],
        "employees": [...]
    }
    
    Или только сотрудники:
    {
        "employees": [...]
    }
    """
    result = ImportResult()
    
    # Импорт отделов
    departments_data = data.get("departments", [])
    dept_mapping = import_departments(db, departments_data, result) if departments_data else {}
    
    # Импорт должностей
    positions_data = data.get("positions", [])
    pos_mapping = import_positions(db, positions_data, dept_mapping, result) if positions_data else {}
    
    # Импорт сотрудников
    employees_data = data.get("employees", [])
    if employees_data:
        import_employees(db, employees_data, dept_mapping, pos_mapping, result, create_hr_requests)
    
    return result


def import_from_file(
    db: Session,
    file_path: str,
    create_hr_requests: bool = False,
) -> ImportResult:
    """Импортирует данные из JSON файла"""
    
    path = Path(file_path)
    if not path.exists():
        result = ImportResult()
        result.errors.append(f"Файл не найден: {file_path}")
        return result
    
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        result = ImportResult()
        result.errors.append(f"Ошибка парсинга JSON: {e}")
        return result
    
    return import_from_json(db, data, create_hr_requests)


def import_from_directory(
    db: Session,
    directory: str,
    create_hr_requests: bool = False,
    archive_processed: bool = True,
) -> dict:
    """
    Импортирует все JSON файлы из директории.
    Обрабатывает файлы в алфавитном порядке.
    """
    results = {}
    dir_path = Path(directory)
    
    if not dir_path.exists():
        return {"error": f"Директория не найдена: {directory}"}
    
    # Создаём папку для обработанных файлов
    archive_dir = dir_path / "processed"
    if archive_processed:
        archive_dir.mkdir(exist_ok=True)
    
    # Обрабатываем JSON файлы
    json_files = sorted(dir_path.glob("*.json"))
    
    for json_file in json_files:
        result = import_from_file(db, str(json_file), create_hr_requests)
        results[json_file.name] = {
            "departments": {"created": result.departments_created, "updated": result.departments_updated},
            "positions": {"created": result.positions_created, "updated": result.positions_updated},
            "employees": {"created": result.employees_created, "updated": result.employees_updated},
            "hr_requests": {"hire": result.hire_requests_created, "fire": result.fire_requests_created},
            "errors": result.errors,
        }
        
        # Перемещаем обработанный файл
        if archive_processed and not result.errors:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            new_name = f"{json_file.stem}_{timestamp}{json_file.suffix}"
            json_file.rename(archive_dir / new_name)
    
    return results
