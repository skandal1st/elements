"""
Сервис интеграции с 1С ЗУП.

Поддерживает:
- Синхронизацию отделов, должностей, сотрудников
- Webhook для событий приёма/увольнения
- Создание HR-заявок и тикетов в SupporIT
"""

from dataclasses import dataclass
from datetime import date
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.department import Department
from app.models.employee import Employee
from app.models.hr_request import HRRequest
from app.models.position import Position
from app.services.integrations import create_supporit_ticket
from app.utils.naming import generate_corporate_email


@dataclass
class ZupSyncResult:
    """Результат синхронизации с ЗУП"""
    created: int = 0
    updated: int = 0
    errors: int = 0


def _get_zup_client() -> httpx.Client | None:
    """Создает HTTP клиент для работы с API 1С ЗУП"""
    if not settings.zup_api_url or not settings.zup_username or not settings.zup_password:
        return None
    return httpx.Client(
        timeout=30,
        auth=(settings.zup_username, settings.zup_password),
        headers={"Accept": "application/json"},
    )


def fetch_zup_departments() -> list[dict]:
    """Получает список подразделений из 1С ЗУП"""
    client = _get_zup_client()
    if not client:
        return []
    
    base_url = settings.zup_api_url.rstrip("/")
    try:
        # Стандартный OData endpoint для подразделений в ЗУП
        response = client.get(f"{base_url}/Catalog_ПодразделенияОрганизаций?$format=json")
        response.raise_for_status()
        payload = response.json()
        return payload.get("value", [])
    except httpx.HTTPError as e:
        print(f"Ошибка получения подразделений из ЗУП: {e}")
        return []
    finally:
        client.close()


def fetch_zup_positions() -> list[dict]:
    """Получает список должностей из 1С ЗУП"""
    client = _get_zup_client()
    if not client:
        return []
    
    base_url = settings.zup_api_url.rstrip("/")
    try:
        # Стандартный OData endpoint для должностей в ЗУП
        response = client.get(f"{base_url}/Catalog_Должности?$format=json")
        response.raise_for_status()
        payload = response.json()
        return payload.get("value", [])
    except httpx.HTTPError as e:
        print(f"Ошибка получения должностей из ЗУП: {e}")
        return []
    finally:
        client.close()


def fetch_zup_employees() -> list[dict]:
    """Получает список сотрудников из 1С ЗУП"""
    client = _get_zup_client()
    if not client:
        return []
    
    base_url = settings.zup_api_url.rstrip("/")
    try:
        # Стандартный OData endpoint для сотрудников в ЗУП
        # Включаем связанные данные
        response = client.get(
            f"{base_url}/Catalog_Сотрудники?$format=json"
            "&$expand=Подразделение,Должность"
        )
        response.raise_for_status()
        payload = response.json()
        return payload.get("value", [])
    except httpx.HTTPError as e:
        print(f"Ошибка получения сотрудников из ЗУП: {e}")
        return []
    finally:
        client.close()


def sync_departments_from_zup(db: Session) -> ZupSyncResult:
    """Синхронизирует подразделения из 1С ЗУП"""
    result = ZupSyncResult()
    departments = fetch_zup_departments()
    
    for dept_data in departments:
        try:
            external_id = dept_data.get("Ref_Key") or dept_data.get("id")
            name = dept_data.get("Description") or dept_data.get("Наименование") or dept_data.get("name")
            parent_ext_id = dept_data.get("Родитель_Key") or dept_data.get("parent_id")
            
            if not external_id or not name:
                continue
            
            # Ищем существующий отдел
            department = db.query(Department).filter(
                Department.external_id == external_id
            ).first()
            
            # Ищем родительский отдел
            parent_id = None
            if parent_ext_id:
                parent = db.query(Department).filter(
                    Department.external_id == parent_ext_id
                ).first()
                if parent:
                    parent_id = parent.id
            
            if department:
                # Обновляем
                department.name = name
                department.parent_department_id = parent_id
                result.updated += 1
            else:
                # Создаём
                department = Department(
                    name=name,
                    external_id=external_id,
                    parent_department_id=parent_id,
                )
                db.add(department)
                result.created += 1
                
        except Exception as e:
            print(f"Ошибка синхронизации подразделения: {e}")
            result.errors += 1
    
    db.commit()
    return result


def sync_positions_from_zup(db: Session) -> ZupSyncResult:
    """Синхронизирует должности из 1С ЗУП"""
    result = ZupSyncResult()
    positions = fetch_zup_positions()
    
    for pos_data in positions:
        try:
            external_id = pos_data.get("Ref_Key") or pos_data.get("id")
            name = pos_data.get("Description") or pos_data.get("Наименование") or pos_data.get("name")
            
            if not external_id or not name:
                continue
            
            # Ищем существующую должность
            position = db.query(Position).filter(
                Position.external_id == external_id
            ).first()
            
            if position:
                position.name = name
                result.updated += 1
            else:
                position = Position(
                    name=name,
                    external_id=external_id,
                )
                db.add(position)
                result.created += 1
                
        except Exception as e:
            print(f"Ошибка синхронизации должности: {e}")
            result.errors += 1
    
    db.commit()
    return result


def sync_employees_from_zup(db: Session) -> ZupSyncResult:
    """Синхронизирует сотрудников из 1С ЗУП"""
    result = ZupSyncResult()
    employees = fetch_zup_employees()
    
    for emp_data in employees:
        try:
            external_id = emp_data.get("Ref_Key") or emp_data.get("id")
            full_name = (
                emp_data.get("Description") or 
                emp_data.get("Наименование") or 
                emp_data.get("ФИО") or
                emp_data.get("full_name") or
                emp_data.get("fio")
            )
            
            if not external_id or not full_name:
                continue
            
            # Извлекаем данные
            birthday_str = emp_data.get("ДатаРождения") or emp_data.get("birthday")
            birthday = None
            if birthday_str:
                try:
                    if isinstance(birthday_str, str):
                        # Формат 1С: "1990-01-15T00:00:00"
                        birthday = date.fromisoformat(birthday_str.split("T")[0])
                except (ValueError, AttributeError):
                    pass
            
            phone = emp_data.get("Телефон") or emp_data.get("phone")
            email = emp_data.get("Email") or emp_data.get("email")
            
            # Ищем отдел по external_id
            dept_ext_id = (
                emp_data.get("Подразделение_Key") or 
                emp_data.get("department_id") or
                (emp_data.get("Подразделение", {}) or {}).get("Ref_Key")
            )
            department_id = None
            if dept_ext_id:
                dept = db.query(Department).filter(
                    Department.external_id == dept_ext_id
                ).first()
                if dept:
                    department_id = dept.id
            
            # Ищем должность по external_id
            pos_ext_id = (
                emp_data.get("Должность_Key") or 
                emp_data.get("position_id") or
                (emp_data.get("Должность", {}) or {}).get("Ref_Key")
            )
            position_id = None
            if pos_ext_id:
                pos = db.query(Position).filter(
                    Position.external_id == pos_ext_id
                ).first()
                if pos:
                    position_id = pos.id
            
            # Статус сотрудника
            is_dismissed = emp_data.get("Уволен", False) or emp_data.get("dismissed", False)
            status = "dismissed" if is_dismissed else "active"
            
            # Ищем существующего сотрудника
            employee = db.query(Employee).filter(
                Employee.external_id == external_id
            ).first()
            
            if employee:
                # Обновляем
                employee.full_name = full_name
                employee.birthday = birthday
                employee.department_id = department_id
                employee.position_id = position_id
                employee.internal_phone = phone or employee.internal_phone
                employee.email = email or employee.email
                employee.status = status
                result.updated += 1
            else:
                # Создаём
                employee = Employee(
                    full_name=full_name,
                    external_id=external_id,
                    birthday=birthday,
                    department_id=department_id,
                    position_id=position_id,
                    internal_phone=phone,
                    email=email,
                    status=status,
                )
                db.add(employee)
                result.created += 1
                
        except Exception as e:
            print(f"Ошибка синхронизации сотрудника: {e}")
            result.errors += 1
    
    db.commit()
    return result


def sync_all_from_zup(db: Session) -> dict:
    """Полная синхронизация всех данных из 1С ЗУП"""
    # Порядок важен: сначала отделы, потом должности, потом сотрудники
    dept_result = sync_departments_from_zup(db)
    pos_result = sync_positions_from_zup(db)
    emp_result = sync_employees_from_zup(db)
    
    return {
        "departments": {
            "created": dept_result.created,
            "updated": dept_result.updated,
            "errors": dept_result.errors,
        },
        "positions": {
            "created": pos_result.created,
            "updated": pos_result.updated,
            "errors": pos_result.errors,
        },
        "employees": {
            "created": emp_result.created,
            "updated": emp_result.updated,
            "errors": emp_result.errors,
        },
    }


def process_zup_hire_event(
    db: Session,
    employee_external_id: str,
    full_name: str,
    department_name: Optional[str] = None,
    position_name: Optional[str] = None,
    effective_date: Optional[date] = None,
    needs_it_equipment: bool = True,
) -> dict:
    """
    Обрабатывает событие приёма на работу из 1С ЗУП.
    Создаёт сотрудника (если нет), HR-заявку и тикет в SupporIT.
    """
    # Ищем или создаём сотрудника
    employee = db.query(Employee).filter(
        Employee.external_id == employee_external_id
    ).first()
    
    if not employee:
        # Ищем отдел
        department_id = None
        if department_name:
            dept = db.query(Department).filter(
                Department.name == department_name
            ).first()
            if dept:
                department_id = dept.id
        
        # Ищем должность
        position_id = None
        if position_name:
            pos = db.query(Position).filter(
                Position.name == position_name
            ).first()
            if pos:
                position_id = pos.id
        
        employee = Employee(
            full_name=full_name,
            external_id=employee_external_id,
            department_id=department_id,
            position_id=position_id,
            status="candidate",
        )
        db.add(employee)
        db.flush()  # Получаем ID
    
    # Создаём HR-заявку
    hr_request = HRRequest(
        employee_id=employee.id,
        type="hire",
        status="pending",
        request_date=date.today(),
        effective_date=effective_date or date.today(),
        needs_it_equipment=needs_it_equipment,
    )
    db.add(hr_request)
    db.commit()
    
    # Генерируем email
    email = generate_corporate_email(employee.full_name)
    
    # Создаём тикет в SupporIT
    description = (
        f"HR: Приём на работу (из 1С ЗУП)\n\n"
        f"ФИО: {employee.full_name}\n"
        f"Email: {email}\n"
        f"Отдел: {department_name or 'Не указан'}\n"
        f"Должность: {position_name or 'Не указана'}\n"
        f"Дата выхода: {effective_date or 'Не указана'}\n"
    )
    
    ticket_created = create_supporit_ticket(
        title=f"Онбординг: {employee.full_name}",
        description=description,
        category="other",
    )
    
    return {
        "employee_id": employee.id,
        "hr_request_id": hr_request.id,
        "supporit_ticket_created": ticket_created,
    }


def process_zup_fire_event(
    db: Session,
    employee_external_id: str,
    effective_date: Optional[date] = None,
) -> dict:
    """
    Обрабатывает событие увольнения из 1С ЗУП.
    Создаёт HR-заявку и тикет в SupporIT.
    """
    # Ищем сотрудника
    employee = db.query(Employee).filter(
        Employee.external_id == employee_external_id
    ).first()
    
    if not employee:
        return {"error": "Сотрудник не найден", "external_id": employee_external_id}
    
    # Создаём HR-заявку
    hr_request = HRRequest(
        employee_id=employee.id,
        type="fire",
        status="pending",
        request_date=date.today(),
        effective_date=effective_date or date.today(),
    )
    db.add(hr_request)
    db.commit()
    
    # Получаем отдел и должность
    department_name = employee.department.name if employee.department else "Не указан"
    position_name = employee.position.name if employee.position else "Не указана"
    
    # Создаём тикет в SupporIT
    description = (
        f"HR: Увольнение сотрудника (из 1С ЗУП)\n\n"
        f"ФИО: {employee.full_name}\n"
        f"Email: {employee.email or 'Не указан'}\n"
        f"Отдел: {department_name}\n"
        f"Должность: {position_name}\n"
        f"Дата увольнения: {effective_date or 'Не указана'}\n\n"
        f"Необходимо:\n"
        f"- Заблокировать учётные записи\n"
        f"- Принять оборудование\n"
    )
    
    ticket_created = create_supporit_ticket(
        title=f"Увольнение: {employee.full_name}",
        description=description,
        category="other",
    )
    
    return {
        "employee_id": employee.id,
        "hr_request_id": hr_request.id,
        "supporit_ticket_created": ticket_created,
    }
