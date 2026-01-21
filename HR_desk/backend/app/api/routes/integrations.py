from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.core.security import get_password_hash
from app.models.department import Department
from app.models.employee import Employee
from app.models.equipment import Equipment
from app.models.position import Position
from app.models.user import User
from app.services.audit import log_action
from app.services.integrations import (
    ad_sync_users,
    create_supporit_user,
    fetch_equipment_for_employee,
    fetch_supporit_users,
    fetch_zup_employees,
    provision_it_accounts,
    sync_users_to_supporit,
    update_supporit_user,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


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
    db: Session = Depends(get_db),
    email: str | None = Query(default=None),
) -> list[dict]:
    equipment = fetch_equipment_for_employee(employee_id, email)
    if equipment:
        for item in equipment:
            db.add(Equipment(**item))
        db.commit()
    return equipment


@router.post("/ad/provision", dependencies=[Depends(require_roles(["it"]))])
def provision_accounts(full_name: str) -> dict:
    accounts = provision_it_accounts(full_name)
    return {
        "ad_account": accounts.ad_account,
        "mailcow_account": accounts.mailcow_account,
        "messenger_account": accounts.messenger_account,
    }


@router.post("/ad/pull-users", dependencies=[Depends(require_roles(["it"]))])
def pull_users_from_ad(db: Session = Depends(get_db)) -> dict:
    users = ad_sync_users()
    created = 0
    updated = 0
    for user in users:
        email = user.get("email")
        if not email:
            continue
        employee = db.query(Employee).filter(Employee.email == email).first()
        if employee:
            employee.full_name = user.get("full_name") or employee.full_name
            employee.internal_phone = user.get("phone") or employee.internal_phone
            updated += 1
        else:
            db.add(
                Employee(
                    full_name=user.get("full_name") or email,
                    email=email,
                    internal_phone=user.get("phone"),
                    status="active",
                )
            )
            created += 1
    db.commit()
    return {"created": created, "updated": updated}


@router.post(
    "/supporit/pull-users", dependencies=[Depends(require_roles(["it", "admin"]))]
)
def pull_users_from_supporit(db: Session = Depends(get_db)) -> dict:
    """Синхронизация сотрудников (employees) из SupportIT"""
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
            employee.department_id = employee.department_id
            employee.internal_phone = user.get("phone") or employee.internal_phone
            updated += 1
        else:
            employee = Employee(
                full_name=full_name or email,
                email=email,
                internal_phone=user.get("phone"),
                status="active",
            )
            db.add(employee)
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
    """Синхронизация учётных записей (users) из SupportIT в HR_desk.

    Роли маппятся:
    - admin -> admin
    - it_specialist -> it
    - employee -> auditor (только просмотр)
    """
    supporit_users = fetch_supporit_users()
    created = 0
    updated = 0
    skipped = 0

    # Маппинг ролей SupportIT -> HR_desk
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

        existing_user = db.query(User).filter(User.username == email).first()

        if existing_user:
            # Обновляем роль и ФИО
            changed = False
            if existing_user.role != hr_role:
                existing_user.role = hr_role
                changed = True
            if full_name and existing_user.full_name != full_name:
                existing_user.full_name = full_name
                changed = True
            if changed:
                updated += 1
            else:
                skipped += 1
        else:
            # Создаём нового пользователя
            new_user = User(
                username=email,
                hashed_password=get_password_hash(default_password),
                role=hr_role,
                full_name=full_name or None,
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
    users_by_email = {user.get("email"): user for user in users if user.get("email")}
    updated = 0
    created = 0
    skipped = 0

    for employee in db.query(Employee).filter(Employee.status == "active").all():
        if not employee.email:
            skipped += 1
            continue

        # Получаем название отдела и должности
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
            # Обновляем существующего
            if update_supporit_user(supporit_user.get("id"), payload):
                updated += 1
        elif create_missing:
            # Создаём нового
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
    """Массовая синхронизация всех активных сотрудников в SupportIT"""
    users_to_sync = []

    for employee in db.query(Employee).filter(Employee.status == "active").all():
        if not employee.email:
            continue

        # Получаем название отдела и должности
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


@router.post("/zup/pull-users", dependencies=[Depends(require_roles(["hr", "it"]))])
def pull_users_from_zup(db: Session = Depends(get_db)) -> dict:
    users = fetch_zup_employees()
    created = 0
    updated = 0
    for user in users:
        external_id = user.get("id") or user.get("external_id")
        email = user.get("email")
        full_name = user.get("full_name") or user.get("fio") or ""
        employee = None
        if external_id:
            employee = (
                db.query(Employee).filter(Employee.external_id == external_id).first()
            )
        if not employee and email:
            employee = db.query(Employee).filter(Employee.email == email).first()
        if employee:
            employee.full_name = full_name or employee.full_name
            employee.external_id = external_id or employee.external_id
            employee.internal_phone = user.get("phone") or employee.internal_phone
            updated += 1
        else:
            db.add(
                Employee(
                    full_name=full_name or email or "Сотрудник",
                    email=email,
                    internal_phone=user.get("phone"),
                    status="active",
                    external_id=external_id,
                )
            )
            created += 1
    db.commit()
    return {"created": created, "updated": updated}
