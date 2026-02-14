"""
Роуты интеграций HR-модуля: SupportIT API, AD provisioning и 1С ЗУП.
"""

import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from backend.core.auth import get_password_hash
from backend.core.config import settings
from backend.modules.hr.dependencies import get_db, get_current_user, require_roles
from backend.modules.hr.models.department import Department
from backend.modules.hr.models.employee import Employee
from backend.modules.hr.models.hr_request import HRRequest
from backend.modules.hr.models.position import Position
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User
from backend.modules.hr.services.audit import log_action
from backend.modules.hr.services.integrations import (
    ad_sync_users,
    provision_it_accounts,
)
from backend.modules.hr.services.supporit_integration import (
    create_supporit_user,
    fetch_equipment_from_supporit,
    fetch_supporit_users,
    sync_users_to_supporit,
    update_supporit_user,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


# --- SupportIT ---


# ВАЖНО: health должен быть ПЕРЕД {employee_id}, иначе FastAPI парсит "health" как int
@router.get("/supporit/health", dependencies=[Depends(require_roles(["it", "admin"]))])
def supporit_healthcheck() -> dict:
    users = fetch_supporit_users()
    return {"status": "ok", "users_count": len(users)}


@router.get(
    "/supporit/{employee_id}", dependencies=[Depends(require_roles(["it", "admin"]))]
)
def get_supporit_equipment(
    employee_id: int,
    email: str | None = Query(default=None),
) -> list[dict]:
    return fetch_equipment_from_supporit(employee_id, email)


@router.post(
    "/supporit/pull-users", dependencies=[Depends(require_roles(["it", "admin"]))]
)
def pull_users_from_supporit(db: Session = Depends(get_db)) -> dict:
    """Синхронизация сотрудников (employees) из SupportIT."""
    users = fetch_supporit_users()
    created = 0
    updated = 0
    for user in users:
        email = user.get("email")
        full_name = user.get("full_name") or user.get("fullName") or ""
        if not email:
            continue
        employee = db.query(Employee).filter(Employee.email == email).first()
        if employee:
            employee.full_name = full_name or employee.full_name
            employee.internal_phone = user.get("phone") or employee.internal_phone
            updated += 1
        else:
            db.add(
                Employee(
                    full_name=full_name or email,
                    email=email,
                    internal_phone=user.get("phone"),
                    status="active",
                )
            )
            created += 1
    db.commit()
    return {"created": created, "updated": updated}


@router.post(
    "/supporit/pull-accounts", dependencies=[Depends(require_roles(["admin"]))]
)
def pull_accounts_from_supporit(
    db: Session = Depends(get_db),
    default_password: str = Query(
        default="ChangeMe123!",
        description="Пароль по умолчанию для новых пользователей",
    ),
) -> dict:
    """Синхронизация учётных записей (users) из SupportIT.

    Роли маппятся:
    - admin -> admin
    - it_specialist -> it
    - employee -> auditor (только просмотр)
    """
    supporit_users = fetch_supporit_users()
    created = 0
    updated = 0
    skipped = 0

    role_mapping = {
        "admin": "admin",
        "it_specialist": "it",
        "employee": "auditor",
    }

    for su in supporit_users:
        email = su.get("email")
        if not email:
            skipped += 1
            continue

        supporit_role = su.get("role", "employee")
        hr_role = role_mapping.get(supporit_role, "auditor")
        full_name = su.get("full_name") or su.get("fullName") or ""

        existing_user = db.query(User).filter(User.email == email).first()

        if existing_user:
            changed = False
            current_hr_role = (existing_user.roles or {}).get("hr")
            if current_hr_role != hr_role:
                roles = dict(existing_user.roles or {})
                roles["hr"] = hr_role
                existing_user.roles = roles
                changed = True
            if full_name and existing_user.full_name != full_name:
                existing_user.full_name = full_name
                changed = True
            if changed:
                updated += 1
            else:
                skipped += 1
        else:
            new_user = User(
                email=email,
                username=email,
                password_hash=get_password_hash(default_password),
                roles={"hr": hr_role},
                full_name=full_name or email,
            )
            db.add(new_user)
            created += 1

    db.commit()
    log_action(
        db,
        "system",
        "sync",
        "users",
        f"from SupportIT: created={created}, updated={updated}",
    )

    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "total": len(supporit_users),
        "default_password": default_password if created > 0 else None,
    }


@router.post(
    "/supporit/push-contacts",
    dependencies=[Depends(require_roles(["it", "hr", "admin"]))],
)
def push_contacts_to_supporit(
    db: Session = Depends(get_db),
    create_missing: bool = False,
) -> dict:
    users = fetch_supporit_users()
    users_by_email = {u.get("email"): u for u in users if u.get("email")}
    updated = 0
    created = 0
    skipped = 0

    for employee in db.query(Employee).filter(Employee.status == "active").all():
        if not employee.email:
            skipped += 1
            continue

        department_name = None
        position_name = None
        if employee.department_id:
            dept = (
                db.query(Department)
                .filter(Department.id == employee.department_id)
                .first()
            )
            if dept:
                department_name = dept.name
        if employee.position_id:
            pos = db.query(Position).filter(Position.id == employee.position_id).first()
            if pos:
                position_name = pos.name

        supporit_user = users_by_email.get(employee.email)
        payload = {
            "full_name": employee.full_name,
            "department": department_name,
            "position": position_name,
            "phone": employee.internal_phone or employee.external_phone,
        }

        if supporit_user:
            if update_supporit_user(supporit_user.get("id"), payload):
                updated += 1
        elif create_missing:
            result = create_supporit_user(
                email=employee.email,
                full_name=employee.full_name,
                department=department_name,
                position=position_name,
                phone=employee.internal_phone or employee.external_phone,
            )
            if result:
                created += 1
        else:
            skipped += 1

    return {"updated": updated, "created": created, "skipped": skipped}


@router.post(
    "/supporit/sync-all",
    dependencies=[Depends(require_roles(["it", "admin"]))],
)
def sync_all_to_supporit(db: Session = Depends(get_db)) -> dict:
    """Массовая синхронизация всех активных сотрудников в SupportIT."""
    users_to_sync = []

    for employee in db.query(Employee).filter(Employee.status == "active").all():
        if not employee.email:
            continue

        department_name = None
        position_name = None
        if employee.department_id:
            dept = (
                db.query(Department)
                .filter(Department.id == employee.department_id)
                .first()
            )
            if dept:
                department_name = dept.name
        if employee.position_id:
            pos = db.query(Position).filter(Position.id == employee.position_id).first()
            if pos:
                position_name = pos.name

        users_to_sync.append(
            {
                "email": employee.email,
                "full_name": employee.full_name,
                "department": department_name,
                "position": position_name,
                "phone": employee.internal_phone or employee.external_phone,
            }
        )

    if not users_to_sync:
        return {"success": True, "message": "No users to sync", "total": 0}

    result = sync_users_to_supporit(users_to_sync)
    result["total_employees"] = len(users_to_sync)
    return result


# --- AD Provisioning ---


@router.post("/ad/provision", dependencies=[Depends(require_roles(["it"]))])
def provision_accounts(full_name: str) -> dict:
    accounts = provision_it_accounts(full_name)
    return {
        "ad_account": accounts.ad_account,
        "mailcow_account": accounts.mailcow_account,
        "messenger_account": accounts.messenger_account,
    }


# --- 1С ЗУП ---


def _get_system_setting(db: Session, key: str) -> str | None:
    setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == key)
        .first()
    )
    return setting.setting_value if setting else None


def _update_system_setting(db: Session, key: str, value: str, setting_type: str = "zup") -> None:
    setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == key)
        .first()
    )
    if setting:
        setting.setting_value = value
    else:
        setting = SystemSettings(
            setting_key=key,
            setting_value=value,
            setting_type=setting_type,
        )
        db.add(setting)


@router.get(
    "/zup/debug",
    dependencies=[Depends(require_roles(["hr", "admin"]))],
)
def zup_debug(db: Session = Depends(get_db)) -> dict:
    """Диагностика подключения к 1С ЗУП: показывает что возвращает API."""
    import httpx
    import xml.etree.ElementTree as ET

    url = _get_system_setting(db, "zup_api_url")
    username = _get_system_setting(db, "zup_username")
    password = _get_system_setting(db, "zup_password")

    if not url or not username or not password:
        return {"error": "ЗУП не настроен", "detail": f"url={'есть' if url else 'нет'}, user={'есть' if username else 'нет'}, pass={'есть' if password else 'нет'}"}

    # Автокоррекция URL — дополняем /odata/standard.odata если нужно
    base_url = url.rstrip("/")
    if not base_url.endswith("/odata/standard.odata"):
        if base_url.endswith("/odata"):
            base_url = f"{base_url}/standard.odata"
        else:
            base_url = f"{base_url}/odata/standard.odata"
    result = {"base_url": base_url, "configured_url": url.rstrip("/"), "catalogs": {}}

    try:
        client = httpx.Client(timeout=30, auth=(username, password))

        # 1. Корневой запрос — список доступных сущностей (всегда XML)
        try:
            resp = client.get(f"{base_url}/")
            result["root_status"] = resp.status_code
            result["root_content_type"] = resp.headers.get("content-type", "")

            if resp.status_code == 200:
                # Парсим XML сервисный документ
                try:
                    root = ET.fromstring(resp.text)
                    # Ищем collection элементы
                    ns_app = "http://www.w3.org/2007/app"
                    ns_atom = "http://www.w3.org/2005/Atom"
                    collections = root.findall(f".//{{{ns_app}}}collection")
                    entities = []
                    for col in collections:
                        href = col.attrib.get("href", "")
                        title_el = col.find(f"{{{ns_atom}}}title")
                        title = title_el.text if title_el is not None else href
                        entities.append(title)
                    result["available_entities"] = entities
                    result["entities_count"] = len(entities)
                except ET.ParseError:
                    # Может быть JSON
                    try:
                        root_data = resp.json()
                        entities = root_data.get("value", [])
                        result["available_entities"] = [
                            e.get("name") or e.get("Name") or str(e)
                            for e in entities[:200]
                        ] if isinstance(entities, list) else "unexpected format"
                    except Exception:
                        result["root_text_preview"] = resp.text[:2000]
            else:
                result["root_error"] = f"HTTP {resp.status_code}"
                result["root_body_preview"] = resp.text[:500]
        except Exception as e:
            result["root_error"] = str(e)

        # 2. Пробуем основные каталоги (без $format=json — 1С возвращает XML Atom)
        catalog_variants = {
            "departments": [
                "Catalog_ПодразделенияОрганизаций",
                "Catalog_СтруктураПредприятия",
            ],
            "positions": [
                "Catalog_Должности",
            ],
            "employees": [
                "Catalog_Сотрудники",
                "Catalog_ФизическиеЛица",
            ],
            "hr_history": [
                "InformationRegister_КадроваяИсторияСотрудников_RecordType/SliceLast()",
                "InformationRegister_КадроваяИсторияСотрудников_RecordType",
                "InformationRegister_ТекущиеКадровыеДанныеСотрудников_RecordType",
                "InformationRegister_ТекущиеКадровыеДанныеСотрудников",
            ],
        }

        atom_ns = "http://www.w3.org/2005/Atom"
        ds_ns = "http://schemas.microsoft.com/ado/2007/08/dataservices"
        meta_ns = "http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"

        for group, variants in catalog_variants.items():
            result["catalogs"][group] = {}
            for catalog_name in variants:
                try:
                    # Запрос без $format=json (XML по умолчанию для 1С)
                    resp = client.get(f"{base_url}/{catalog_name}?$top=2")
                    cat_result = {
                        "status": resp.status_code,
                        "content_type": resp.headers.get("content-type", ""),
                    }

                    if resp.status_code == 200:
                        content_type = resp.headers.get("content-type", "")

                        # Пробуем парсить XML Atom
                        if "xml" in content_type or "atom" in content_type or resp.text.strip().startswith("<"):
                            try:
                                feed = ET.fromstring(resp.text)
                                entries = feed.findall(f"{{{atom_ns}}}entry")
                                cat_result["format"] = "xml"
                                cat_result["count"] = len(entries)

                                if entries:
                                    # Извлекаем поля из первой записи
                                    content_el = entries[0].find(f"{{{atom_ns}}}content")
                                    if content_el is not None:
                                        props_el = content_el.find(f"{{{meta_ns}}}properties")
                                        if props_el is not None:
                                            sample = {}
                                            keys = []
                                            for prop in props_el:
                                                tag = prop.tag.split("}", 1)[1] if "}" in prop.tag else prop.tag
                                                keys.append(tag)
                                                is_null = prop.attrib.get(f"{{{meta_ns}}}null", "false") == "true"
                                                sample[tag] = None if is_null else (prop.text or "")
                                            cat_result["keys"] = keys
                                            cat_result["sample"] = sample
                            except ET.ParseError as e:
                                cat_result["parse_error"] = f"XML parse error: {e}"
                                cat_result["body_preview"] = resp.text[:300]
                        else:
                            # Пробуем JSON
                            try:
                                data = resp.json()
                                items = data.get("value", [])
                                cat_result["format"] = "json"
                                cat_result["count"] = len(items)
                                if items:
                                    cat_result["keys"] = list(items[0].keys())
                                    cat_result["sample"] = items[0]
                            except Exception:
                                cat_result["body_preview"] = resp.text[:300]
                    elif resp.status_code == 401:
                        cat_result["error"] = "Ошибка авторизации (401)"
                    elif resp.status_code == 404:
                        cat_result["error"] = "Каталог не найден (404)"
                    else:
                        cat_result["body_preview"] = resp.text[:300]

                    result["catalogs"][group][catalog_name] = cat_result
                except Exception as e:
                    result["catalogs"][group][catalog_name] = {"error": str(e)}

        client.close()
    except Exception as e:
        result["connection_error"] = str(e)

    return result


@router.post(
    "/zup/sync",
    dependencies=[Depends(require_roles(["hr", "admin"]))],
)
def zup_sync(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """Запустить полную синхронизацию с 1С ЗУП."""
    from backend.modules.hr.services.zup import sync_all_from_zup

    # Проверяем настроенность
    enabled = _get_system_setting(db, "zup_enabled")
    url = _get_system_setting(db, "zup_api_url")
    username = _get_system_setting(db, "zup_username")
    password = _get_system_setting(db, "zup_password")

    if not url or not username or not password:
        raise HTTPException(status_code=400, detail="1С ЗУП не настроен. Заполните настройки в разделе Настройки → 1С ЗУП.")

    if enabled and enabled.lower() != "true":
        raise HTTPException(status_code=400, detail="Интеграция с 1С ЗУП отключена.")

    result = sync_all_from_zup(db)

    # Сохраняем результат последней синхронизации
    _update_system_setting(db, "zup_last_sync", datetime.utcnow().isoformat())
    _update_system_setting(db, "zup_last_sync_result", json.dumps(result, ensure_ascii=False, default=str))
    db.commit()

    log_action(
        db,
        current_user.email,
        "zup_sync",
        "integration",
        f"Синхронизация ЗУП: отделы={result['departments']['created']}/{result['departments']['updated']}, "
        f"должности={result['positions']['created']}/{result['positions']['updated']}, "
        f"сотрудники={result['employees']['created']}/{result['employees']['updated']}, "
        f"приём={result['employees']['hired']}, увольнение={result['employees']['fired']}, "
        f"смена должности={result['employees']['position_changed']}",
    )

    return result


@router.get(
    "/zup/status",
    dependencies=[Depends(require_roles(["hr", "admin"]))],
)
def zup_status(db: Session = Depends(get_db)) -> dict:
    """Получить статус интеграции с 1С ЗУП."""
    url = _get_system_setting(db, "zup_api_url")
    username = _get_system_setting(db, "zup_username")
    password = _get_system_setting(db, "zup_password")
    enabled_val = _get_system_setting(db, "zup_enabled")
    interval = _get_system_setting(db, "zup_sync_interval_minutes")
    last_sync = _get_system_setting(db, "zup_last_sync")
    last_sync_result_str = _get_system_setting(db, "zup_last_sync_result")

    configured = bool(url and username and password)
    enabled = bool(enabled_val and enabled_val.lower() == "true")

    last_sync_result = None
    if last_sync_result_str:
        try:
            last_sync_result = json.loads(last_sync_result_str)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "configured": configured,
        "enabled": enabled,
        "last_sync": last_sync,
        "last_sync_result": last_sync_result,
        "sync_interval_minutes": int(interval) if interval else 60,
    }


@router.post(
    "/zup/cleanup",
    dependencies=[Depends(require_roles(["admin"]))],
)
def zup_cleanup(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """Очистка данных после неудачной синхронизации с 1С ЗУП.

    1. Объединяет дубли (одинаковые ФИО): переносит external_id на старую запись, удаляет новую.
    2. Удаляет уволенных сотрудников, пришедших из ЗУП.
    3. Удаляет HR-заявки (тип hire), созданные синхронизацией.
    4. Удаляет IT-тикеты «Онбординг», созданные синхронизацией.
    """
    from backend.modules.it.models import Ticket

    merged_duplicates = 0
    deleted_dismissed = 0
    deleted_hr_requests = 0
    deleted_tickets = 0

    # --- 1. Объединяем дубли ---
    # Находим ФИО, которые встречаются > 1 раза
    dupes = (
        db.query(Employee.full_name)
        .group_by(Employee.full_name)
        .having(sa_func.count(Employee.id) > 1)
        .all()
    )
    for (name,) in dupes:
        employees = (
            db.query(Employee)
            .filter(Employee.full_name == name)
            .order_by(Employee.id)
            .all()
        )
        if len(employees) < 2:
            continue

        # Оставляем самого старого (первого по ID)
        original = employees[0]
        for dup in employees[1:]:
            # Переносим external_id если у оригинала нет
            if dup.external_id and not original.external_id:
                original.external_id = dup.external_id
            # Переносим данные если у оригинала пусто
            if dup.birthday and not original.birthday:
                original.birthday = dup.birthday
            if dup.department_id and not original.department_id:
                original.department_id = dup.department_id
            if dup.position_id and not original.position_id:
                original.position_id = dup.position_id
            if dup.email and not original.email:
                original.email = dup.email
            if dup.internal_phone and not original.internal_phone:
                original.internal_phone = dup.internal_phone
            # Удаляем HR-заявки дубля
            db.query(HRRequest).filter(HRRequest.employee_id == dup.id).delete()
            # Удаляем IT-тикеты дубля
            db.query(Ticket).filter(Ticket.employee_id == dup.id).delete()
            # Удаляем дубля
            db.delete(dup)
            merged_duplicates += 1

    db.flush()

    # --- 2. Удаляем уволенных из ЗУП ---
    dismissed_from_zup = (
        db.query(Employee)
        .filter(
            Employee.external_id.isnot(None),
            Employee.status == "dismissed",
        )
        .all()
    )
    for emp in dismissed_from_zup:
        db.query(HRRequest).filter(HRRequest.employee_id == emp.id).delete()
        db.query(Ticket).filter(Ticket.employee_id == emp.id).delete()
        db.delete(emp)
        deleted_dismissed += 1

    db.flush()

    # --- 3. Удаляем HR-заявки на приём (созданные синхронизацией) ---
    hire_requests = (
        db.query(HRRequest)
        .filter(
            HRRequest.type == "hire",
            HRRequest.request_date == date.today(),
        )
        .all()
    )
    for hr in hire_requests:
        db.delete(hr)
        deleted_hr_requests += 1

    # --- 4. Удаляем тикеты «Онбординг» ---
    onboarding_tickets = (
        db.query(Ticket)
        .filter(
            Ticket.title.like("Онбординг:%"),
            Ticket.category == "hr",
            sa_func.date(Ticket.created_at) == date.today(),
        )
        .all()
    )
    for ticket in onboarding_tickets:
        db.delete(ticket)
        deleted_tickets += 1

    db.commit()

    log_action(
        db,
        current_user.email,
        "zup_cleanup",
        "integration",
        f"Очистка ЗУП: дублей={merged_duplicates}, уволенных={deleted_dismissed}, "
        f"HR-заявок={deleted_hr_requests}, тикетов={deleted_tickets}",
    )

    return {
        "merged_duplicates": merged_duplicates,
        "deleted_dismissed": deleted_dismissed,
        "deleted_hr_requests": deleted_hr_requests,
        "deleted_tickets": deleted_tickets,
    }
