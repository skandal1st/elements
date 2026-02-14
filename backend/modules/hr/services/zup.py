"""
Сервис интеграции с 1С ЗУП.

Поддерживает:
- Синхронизацию отделов, должностей, сотрудников
- Детекцию кадровых событий (приём, увольнение, смена должности)
- Создание HR-заявок и IT-тикетов
"""

import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from backend.modules.hr.models.department import Department
from backend.modules.hr.models.employee import Employee
from backend.modules.hr.models.hr_request import HRRequest
from backend.modules.hr.models.position import Position
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.services.audit import log_action
from backend.modules.hr.services.integrations import create_it_ticket
from backend.modules.hr.utils.naming import generate_corporate_email

logger = logging.getLogger(__name__)


@dataclass
class ZupSyncResult:
    """Результат синхронизации с ЗУП"""
    created: int = 0
    updated: int = 0
    errors: int = 0
    hired: int = 0
    fired: int = 0
    position_changed: int = 0
    error_details: list = field(default_factory=list)


def _get_setting(db: Session, key: str) -> Optional[str]:
    """Читает настройку из system_settings."""
    setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == key)
        .first()
    )
    return setting.setting_value if setting else None


def _get_zup_client(db: Session) -> httpx.Client | None:
    """Создает HTTP клиент для работы с API 1С ЗУП (настройки из БД)."""
    url = _get_setting(db, "zup_api_url")
    username = _get_setting(db, "zup_username")
    password = _get_setting(db, "zup_password")
    if not url or not username or not password:
        return None
    return httpx.Client(
        timeout=30,
        auth=(username, password),
    )


def _get_zup_base_url(db: Session) -> str | None:
    """Возвращает base URL для API ЗУП."""
    url = _get_setting(db, "zup_api_url")
    return url.rstrip("/") if url else None


# --- Парсинг OData Atom XML (формат 1С по умолчанию) ---

_ATOM_NS = "http://www.w3.org/2005/Atom"
_DATASERVICES_NS = "http://schemas.microsoft.com/ado/2007/08/dataservices"
_METADATA_NS = "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"


_EMPTY_GUID = "00000000-0000-0000-0000-000000000000"


def _parse_atom_xml(text: str) -> list[dict]:
    """Парсит OData Atom XML ответ от 1С в список словарей."""
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        logger.error("Не удалось распарсить XML от 1С ЗУП")
        return []

    entries = root.findall(f"{{{_ATOM_NS}}}entry")
    results = []

    for entry in entries:
        content = entry.find(f"{{{_ATOM_NS}}}content")
        if content is None:
            continue
        properties = content.find(f"{{{_METADATA_NS}}}properties")
        if properties is None:
            continue

        item = {}
        for prop in properties:
            # Тег вида {namespace}ИмяПоля
            tag = prop.tag
            if "}" in tag:
                tag = tag.split("}", 1)[1]
            # Проверяем m:null="true"
            is_null = prop.attrib.get(f"{{{_METADATA_NS}}}null", "false") == "true"
            value = None if is_null else (prop.text or "")
            # Пустые GUID от 1С считаем как None
            if value == _EMPTY_GUID:
                value = None
            item[tag] = value
        results.append(item)

    return results


def _parse_odata_response(response: httpx.Response) -> list[dict]:
    """Парсит ответ OData: сначала пробует JSON, затем XML Atom."""
    content_type = response.headers.get("content-type", "")

    # Попытка JSON
    if "json" in content_type or "javascript" in content_type:
        try:
            data = response.json()
            return data.get("value", [])
        except Exception:
            pass

    # Попытка XML (Atom) — формат 1С по умолчанию
    if "xml" in content_type or "atom" in content_type or response.text.strip().startswith("<"):
        return _parse_atom_xml(response.text)

    # Попытка JSON без учёта content-type
    try:
        data = response.json()
        return data.get("value", [])
    except Exception:
        pass

    # Последняя попытка — XML
    return _parse_atom_xml(response.text)


def _has_recent_hr_request(db: Session, employee_id: int, request_type: str) -> bool:
    """Проверяет наличие HR-заявки того же типа за сегодня (защита от дубликатов)."""
    today = date.today()
    existing = (
        db.query(HRRequest)
        .filter(
            HRRequest.employee_id == employee_id,
            HRRequest.type == request_type,
            HRRequest.request_date == today,
        )
        .first()
    )
    return existing is not None


def _handle_hire_detected(db: Session, employee: Employee, result: ZupSyncResult) -> None:
    """Создаёт HR-заявку на приём и IT-тикет для онбординга."""
    if _has_recent_hr_request(db, employee.id, "hire"):
        return

    hr_request = HRRequest(
        employee_id=employee.id,
        type="hire",
        status="pending",
        request_date=date.today(),
        effective_date=date.today(),
        needs_it_equipment=True,
    )
    db.add(hr_request)
    db.flush()
    result.hired += 1

    email = generate_corporate_email(employee.full_name)
    dept_name = employee.department.name if employee.department else "Не указан"
    pos_name = employee.position.name if employee.position else "Не указана"

    description = (
        f"HR: Приём на работу (из 1С ЗУП)\n\n"
        f"ФИО: {employee.full_name}\n"
        f"Email: {email}\n"
        f"Отдел: {dept_name}\n"
        f"Должность: {pos_name}\n"
        f"Дата выхода: {date.today()}\n"
    )

    create_it_ticket(
        db=db,
        title=f"Онбординг: {employee.full_name}",
        description=description,
        category="hr",
    )


def _handle_fire_detected(db: Session, employee: Employee, result: ZupSyncResult) -> None:
    """Создаёт HR-заявку на увольнение и IT-тикет."""
    if _has_recent_hr_request(db, employee.id, "fire"):
        return

    hr_request = HRRequest(
        employee_id=employee.id,
        type="fire",
        status="pending",
        request_date=date.today(),
        effective_date=date.today(),
    )
    db.add(hr_request)
    db.flush()
    result.fired += 1

    dept_name = employee.department.name if employee.department else "Не указан"
    pos_name = employee.position.name if employee.position else "Не указана"

    description = (
        f"HR: Увольнение сотрудника (из 1С ЗУП)\n\n"
        f"ФИО: {employee.full_name}\n"
        f"Email: {employee.email or 'Не указан'}\n"
        f"Отдел: {dept_name}\n"
        f"Должность: {pos_name}\n"
        f"Дата увольнения: {date.today()}\n\n"
        f"Необходимо:\n"
        f"- Заблокировать учётные записи\n"
        f"- Принять оборудование\n"
    )

    create_it_ticket(
        db=db,
        title=f"Увольнение: {employee.full_name}",
        description=description,
        category="hr",
    )


def _handle_position_change(
    db: Session,
    employee: Employee,
    old_position_id: int | None,
    new_position_id: int | None,
    result: ZupSyncResult,
) -> None:
    """Логирует смену должности."""
    old_pos = db.query(Position).filter(Position.id == old_position_id).first() if old_position_id else None
    new_pos = db.query(Position).filter(Position.id == new_position_id).first() if new_position_id else None
    old_name = old_pos.name if old_pos else "Не указана"
    new_name = new_pos.name if new_pos else "Не указана"

    log_action(
        db,
        "zup_sync",
        "position_change",
        "employee",
        f"{employee.full_name}: {old_name} → {new_name}",
    )
    result.position_changed += 1


def _fetch_odata_catalog(db: Session, catalog_name: str, extra_params: str = "") -> list[dict]:
    """Универсальная функция получения данных из каталога OData 1С ЗУП."""
    client = _get_zup_client(db)
    if not client:
        return []

    base_url = _get_zup_base_url(db)
    url = f"{base_url}/{catalog_name}"
    if extra_params:
        url = f"{url}?{extra_params}"

    try:
        response = client.get(url)
        response.raise_for_status()
        items = _parse_odata_response(response)
        logger.info(f"ЗУП: {catalog_name} — получено {len(items)} записей")
        return items
    except httpx.HTTPError as e:
        logger.error(f"Ошибка получения {catalog_name} из ЗУП: {e}")
        # Попробуем с $format=json на случай если XML не работает
        try:
            sep = "&" if "?" in url else "?"
            response = client.get(f"{url}{sep}$format=json")
            response.raise_for_status()
            items = _parse_odata_response(response)
            logger.info(f"ЗУП: {catalog_name} (json) — получено {len(items)} записей")
            return items
        except Exception:
            return []
    except Exception as e:
        logger.error(f"Ошибка парсинга {catalog_name} из ЗУП: {e}")
        return []
    finally:
        client.close()


def fetch_zup_departments(db: Session) -> list[dict]:
    """Получает список подразделений из 1С ЗУП"""
    return _fetch_odata_catalog(db, "Catalog_ПодразделенияОрганизаций")


def fetch_zup_positions(db: Session) -> list[dict]:
    """Получает список должностей из 1С ЗУП"""
    return _fetch_odata_catalog(db, "Catalog_Должности")


def fetch_zup_employees(db: Session) -> list[dict]:
    """Получает список сотрудников из 1С ЗУП"""
    return _fetch_odata_catalog(db, "Catalog_Сотрудники")


def sync_departments_from_zup(db: Session) -> ZupSyncResult:
    """Синхронизирует подразделения из 1С ЗУП"""
    result = ZupSyncResult()
    departments = fetch_zup_departments(db)

    for dept_data in departments:
        try:
            external_id = dept_data.get("Ref_Key") or dept_data.get("id")
            name = dept_data.get("Description") or dept_data.get("Наименование") or dept_data.get("name")
            parent_ext_id = dept_data.get("Родитель_Key") or dept_data.get("parent_id")

            if not external_id or not name:
                continue

            department = db.query(Department).filter(
                Department.external_id == external_id
            ).first()

            parent_id = None
            if parent_ext_id:
                parent = db.query(Department).filter(
                    Department.external_id == parent_ext_id
                ).first()
                if parent:
                    parent_id = parent.id

            if department:
                department.name = name
                department.parent_department_id = parent_id
                result.updated += 1
            else:
                department = Department(
                    name=name,
                    external_id=external_id,
                    parent_department_id=parent_id,
                )
                db.add(department)
                result.created += 1

        except Exception as e:
            logger.error(f"Ошибка синхронизации подразделения: {e}")
            result.errors += 1
            result.error_details.append(f"Подразделение: {e}")

    db.commit()
    return result


def sync_positions_from_zup(db: Session) -> ZupSyncResult:
    """Синхронизирует должности из 1С ЗУП"""
    result = ZupSyncResult()
    positions = fetch_zup_positions(db)

    for pos_data in positions:
        try:
            external_id = pos_data.get("Ref_Key") or pos_data.get("id")
            name = pos_data.get("Description") or pos_data.get("Наименование") or pos_data.get("name")

            if not external_id or not name:
                continue

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
            logger.error(f"Ошибка синхронизации должности: {e}")
            result.errors += 1
            result.error_details.append(f"Должность: {e}")

    db.commit()
    return result


def sync_employees_from_zup(db: Session) -> ZupSyncResult:
    """Синхронизирует сотрудников из 1С ЗУП с детекцией кадровых событий."""
    result = ZupSyncResult()
    employees = fetch_zup_employees(db)

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

            # Статус сотрудника (из XML приходит строка "true"/"false")
            dismissed_val = emp_data.get("Уволен") or emp_data.get("dismissed") or ""
            is_dismissed = str(dismissed_val).lower() in ("true", "1", "да")
            status = "dismissed" if is_dismissed else "active"

            # Ищем существующего сотрудника
            employee = db.query(Employee).filter(
                Employee.external_id == external_id
            ).first()

            if employee:
                # Сохраняем старые значения до обновления
                old_status = employee.status
                old_position_id = employee.position_id

                # Обновляем
                employee.full_name = full_name
                employee.birthday = birthday
                employee.department_id = department_id
                employee.position_id = position_id
                employee.internal_phone = phone or employee.internal_phone
                employee.email = email or employee.email
                employee.status = status
                result.updated += 1

                # Детекция увольнения
                if old_status in ("active", "candidate") and status == "dismissed":
                    _handle_fire_detected(db, employee, result)

                # Детекция смены должности
                if (
                    old_position_id is not None
                    and position_id is not None
                    and old_position_id != position_id
                    and status == "active"
                ):
                    _handle_position_change(db, employee, old_position_id, position_id, result)
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
                db.flush()
                result.created += 1

                # Детекция нового приёма
                if status == "active":
                    _handle_hire_detected(db, employee, result)

        except Exception as e:
            logger.error(f"Ошибка синхронизации сотрудника: {e}")
            result.errors += 1
            result.error_details.append(f"Сотрудник {full_name}: {e}")

    db.commit()
    return result


def sync_all_from_zup(db: Session) -> dict:
    """Полная синхронизация всех данных из 1С ЗУП"""
    # Порядок важен: сначала отделы, потом должности, потом сотрудники
    dept_result = sync_departments_from_zup(db)
    pos_result = sync_positions_from_zup(db)
    emp_result = sync_employees_from_zup(db)

    return {
        "timestamp": datetime.utcnow().isoformat(),
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
            "hired": emp_result.hired,
            "fired": emp_result.fired,
            "position_changed": emp_result.position_changed,
        },
        "error_details": (
            dept_result.error_details + pos_result.error_details + emp_result.error_details
        ),
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
    employee = db.query(Employee).filter(
        Employee.external_id == employee_external_id
    ).first()

    if not employee:
        department_id = None
        if department_name:
            dept = db.query(Department).filter(
                Department.name == department_name
            ).first()
            if dept:
                department_id = dept.id

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
        db.flush()

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

    email = generate_corporate_email(employee.full_name)

    description = (
        f"HR: Приём на работу (из 1С ЗУП)\n\n"
        f"ФИО: {employee.full_name}\n"
        f"Email: {email}\n"
        f"Отдел: {department_name or 'Не указан'}\n"
        f"Должность: {position_name or 'Не указана'}\n"
        f"Дата выхода: {effective_date or 'Не указана'}\n"
    )

    ticket_created = create_it_ticket(
        db=db,
        title=f"Онбординг: {employee.full_name}",
        description=description,
        category="hr",
    )

    return {
        "employee_id": employee.id,
        "hr_request_id": hr_request.id,
        "it_ticket_created": ticket_created,
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
    employee = db.query(Employee).filter(
        Employee.external_id == employee_external_id
    ).first()

    if not employee:
        return {"error": "Сотрудник не найден", "external_id": employee_external_id}

    hr_request = HRRequest(
        employee_id=employee.id,
        type="fire",
        status="pending",
        request_date=date.today(),
        effective_date=effective_date or date.today(),
    )
    db.add(hr_request)
    db.commit()

    department_name = employee.department.name if employee.department else "Не указан"
    position_name = employee.position.name if employee.position else "Не указана"

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

    ticket_created = create_it_ticket(
        db=db,
        title=f"Увольнение: {employee.full_name}",
        description=description,
        category="hr",
    )

    return {
        "employee_id": employee.id,
        "hr_request_id": hr_request.id,
        "it_ticket_created": ticket_created,
    }
