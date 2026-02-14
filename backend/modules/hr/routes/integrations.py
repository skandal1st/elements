"""
Роуты интеграций HR-модуля: SupportIT API, AD provisioning и 1С ЗУП.
"""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.core.auth import get_password_hash
from backend.core.config import settings
from backend.modules.hr.dependencies import get_db, get_current_user, require_roles
from backend.modules.hr.models.department import Department
from backend.modules.hr.models.employee import Employee
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
