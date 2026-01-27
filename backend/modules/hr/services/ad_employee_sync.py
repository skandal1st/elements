"""
AD/LDAP -> HR Employees sync.

Синхронизирует сотрудников (таблица employees) из LDAP/Active Directory.
Использует настройки из SystemSettings (ключи ldap_*), которые настраиваются в UI.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

from ldap3 import ALL, Connection, Server
from sqlalchemy.orm import Session

from backend.modules.hr.models.department import Department
from backend.modules.hr.models.employee import Employee
from backend.modules.hr.models.position import Position
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User


@dataclass
class LdapConfig:
    enabled: bool
    server: str
    port: int
    use_ssl: bool
    base_dn: str
    bind_dn: str
    bind_password: str
    user_filter: str


def _parse_bool(v: Optional[str], default: bool = False) -> bool:
    if v is None:
        return default
    return str(v).strip().lower() == "true"


def _parse_int(v: Optional[str], default: int) -> int:
    try:
        return int(v) if v is not None else default
    except Exception:
        return default


def _get_settings(db: Session, keys: List[str]) -> Dict[str, Optional[str]]:
    rows = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key.in_(keys))
        .all()
    )
    out: Dict[str, Optional[str]] = {k: None for k in keys}
    for r in rows:
        out[r.setting_key] = r.setting_value
    return out


def load_ldap_config(db: Session) -> LdapConfig:
    keys = [
        "ldap_enabled",
        "ldap_server",
        "ldap_port",
        "ldap_use_ssl",
        "ldap_base_dn",
        "ldap_bind_dn",
        "ldap_bind_password",
        "ldap_user_filter",
    ]
    s = _get_settings(db, keys)
    return LdapConfig(
        enabled=_parse_bool(s.get("ldap_enabled"), False),
        server=(s.get("ldap_server") or "").strip(),
        port=_parse_int(s.get("ldap_port"), 389),
        use_ssl=_parse_bool(s.get("ldap_use_ssl"), False),
        base_dn=(s.get("ldap_base_dn") or "").strip(),
        bind_dn=(s.get("ldap_bind_dn") or "").strip(),
        bind_password=(s.get("ldap_bind_password") or "").strip(),
        user_filter=(s.get("ldap_user_filter") or "(objectClass=user)").strip(),
    )


def _is_account_enabled(user_account_control: Any) -> bool:
    """
    userAccountControl: бит 0x2 = ACCOUNTDISABLE
    """
    if user_account_control is None:
        return True
    try:
        uac = int(str(user_account_control))
        return (uac & 2) == 0
    except Exception:
        return True


def _get_attr(entry: dict, key: str) -> Optional[str]:
    v = entry.get(key)
    if v is None:
        return None
    if isinstance(v, list):
        return str(v[0]) if v else None
    return str(v)


def _paged_search(
    conn: Connection,
    search_base: str,
    search_filter: str,
    attributes: List[str],
    page_size: int = 500,
) -> Iterable[dict]:
    """
    Генератор результатов LDAP поиска с paging.
    """
    cookie = None
    while True:
        conn.search(
            search_base=search_base,
            search_filter=search_filter,
            search_scope="SUBTREE",
            attributes=attributes,
            paged_size=page_size,
            paged_cookie=cookie,
        )
        for e in conn.response:
            if e.get("type") != "searchResEntry":
                continue
            yield e.get("attributes", {})
        cookie = conn.result.get("controls", {}).get("1.2.840.113556.1.4.319", {}).get("value", {}).get("cookie")
        if not cookie:
            break


def _paged_search_entries(
    conn: Connection,
    search_base: str,
    search_filter: str,
    attributes: List[str],
    page_size: int = 500,
) -> Iterable[Tuple[str, dict]]:
    """
    Генератор результатов LDAP поиска с paging, возвращает (dn, attributes).
    """
    cookie = None
    while True:
        conn.search(
            search_base=search_base,
            search_filter=search_filter,
            search_scope="SUBTREE",
            attributes=attributes,
            paged_size=page_size,
            paged_cookie=cookie,
        )
        for e in conn.response:
            if e.get("type") != "searchResEntry":
                continue
            yield (e.get("dn") or ""), (e.get("attributes", {}) or {})
        cookie = (
            conn.result.get("controls", {})
            .get("1.2.840.113556.1.4.319", {})
            .get("value", {})
            .get("cookie")
        )
        if not cookie:
            break


def _get_or_create_department(db: Session, name: str) -> Tuple[Optional[Department], bool]:
    n = (name or "").strip()
    if not n:
        return None, False
    dep = db.query(Department).filter(Department.name == n).first()
    if dep:
        return dep, False
    dep = Department(name=n)
    db.add(dep)
    db.flush()
    return dep, True


def _get_or_create_position(db: Session, name: str, department_id: Optional[int]) -> Tuple[Optional[Position], bool]:
    n = (name or "").strip()
    if not n:
        return None, False
    q = db.query(Position).filter(Position.name == n)
    if department_id is not None:
        q = q.filter(Position.department_id == department_id)
    pos = q.first()
    if pos:
        return pos, False
    pos = Position(name=n, department_id=department_id)
    db.add(pos)
    db.flush()
    return pos, True


def _ldap_escape(v: str) -> str:
    """
    RFC4515: экранирование спецсимволов в LDAP фильтре.
    """
    out = []
    for ch in v:
        if ch == "\\":
            out.append(r"\5c")
        elif ch == "*":
            out.append(r"\2a")
        elif ch == "(":
            out.append(r"\28")
        elif ch == ")":
            out.append(r"\29")
        elif ch == "\x00":
            out.append(r"\00")
        else:
            out.append(ch)
    return "".join(out)


def dismiss_all_ad_employees(db: Session, dry_run: bool = False) -> dict:
    """
    "Очистка" списка сотрудников из AD:
    - всех сотрудников с external_id (то есть созданных/связанных с AD) помечаем status="dismissed"
    - снимаем ссылки manager_id у сотрудников и у департаментов, где менеджер из AD

    Это безопаснее, чем удаление (могут быть внешние связи на Employee).
    """
    ids_subq = db.query(Employee.id).filter(Employee.external_id.isnot(None)).subquery()

    # Снимаем менеджеров у департаментов/сотрудников, чтобы не ссылались на dismissed
    dep_cleared = (
        db.query(Department)
        .filter(Department.manager_id.in_(ids_subq))
        .update({"manager_id": None}, synchronize_session=False)
    )
    emp_mgr_cleared = (
        db.query(Employee)
        .filter(Employee.manager_id.in_(ids_subq))
        .update({"manager_id": None}, synchronize_session=False)
    )

    dismissed = (
        db.query(Employee)
        .filter(Employee.id.in_(ids_subq))
        .filter(Employee.status != "dismissed")
        .update({"status": "dismissed"}, synchronize_session=False)
    )

    if dry_run:
        db.rollback()
    else:
        db.commit()

    return {
        "success": True,
        "departments_manager_cleared": int(dep_cleared or 0),
        "employees_manager_cleared": int(emp_mgr_cleared or 0),
        "dismissed": int(dismissed or 0),
    }


def fetch_ad_users(db: Session, q: Optional[str] = None, limit_pagesize: int = 500) -> List[dict]:
    """
    Получить список пользователей из AD для UI выбора (с поиском).
    Возвращает список словарей: dn, sAMAccountName, displayName, mail, department, title, enabled, imported.
    """
    cfg = load_ldap_config(db)
    if not cfg.enabled:
        raise ValueError("LDAP интеграция отключена (ldap_enabled=false)")
    if not cfg.server or not cfg.base_dn:
        raise ValueError("LDAP не настроен: нужны ldap_server и ldap_base_dn")

    server = Server(cfg.server, port=cfg.port, use_ssl=cfg.use_ssl, get_info=ALL, connect_timeout=10)
    conn = Connection(server, user=cfg.bind_dn or None, password=cfg.bind_password or None, auto_bind=True)

    attributes = [
        "displayName",
        "cn",
        "givenName",
        "sn",
        "mail",
        "userPrincipalName",
        "department",
        "title",
        "sAMAccountName",
        "userAccountControl",
    ]

    search_filter = cfg.user_filter
    if q and q.strip():
        qq = _ldap_escape(q.strip())
        search_filter = f"(&{cfg.user_filter}(|(sAMAccountName=*{qq}*)(displayName=*{qq}*)(cn=*{qq}*)(mail=*{qq}*)(userPrincipalName=*{qq}*)))"

    # Для быстрого определения imported — вытаскиваем существующие external_id в set
    existing = {
        (x[0] or "").strip().lower()
        for x in db.query(Employee.external_id).filter(Employee.external_id.isnot(None)).all()
    }

    out: List[dict] = []
    try:
        for dn, attrs in _paged_search_entries(conn, cfg.base_dn, search_filter, attributes, page_size=limit_pagesize):
            account = (_get_attr(attrs, "sAMAccountName") or "").strip()
            if not account:
                continue
            enabled = _is_account_enabled(_get_attr(attrs, "userAccountControl"))
            display = ((_get_attr(attrs, "displayName") or "").strip() or (_get_attr(attrs, "cn") or "").strip())
            out.append(
                {
                    "dn": dn,
                    "sAMAccountName": account,
                    "displayName": display or account,
                    "mail": (_get_attr(attrs, "mail") or "").strip() or None,
                    "userPrincipalName": (_get_attr(attrs, "userPrincipalName") or "").strip() or None,
                    "department": (_get_attr(attrs, "department") or "").strip() or None,
                    "title": (_get_attr(attrs, "title") or "").strip() or None,
                    "enabled": bool(enabled),
                    "imported": account.strip().lower() in existing,
                }
            )
    finally:
        try:
            conn.unbind()
        except Exception:
            pass

    # Стабильная сортировка: сначала доступные, потом по имени
    out.sort(key=lambda x: (not x.get("enabled", True), (x.get("displayName") or "").lower()))
    return out


def sync_selected_employees_from_ldap(
    db: Session,
    usernames: List[str],
    clear_before: bool = False,
    dry_run: bool = False,
) -> dict:
    """
    Синхронизировать сотрудников только для выбранных логинов (sAMAccountName).
    Если clear_before=True — сначала "очищает" (dismiss) всех AD сотрудников.
    """
    cfg = load_ldap_config(db)
    if not cfg.enabled:
        raise ValueError("LDAP интеграция отключена (ldap_enabled=false)")
    if not cfg.server or not cfg.base_dn:
        raise ValueError("LDAP не настроен: нужны ldap_server и ldap_base_dn")

    usernames_clean = sorted({(u or "").strip() for u in usernames if (u or "").strip()})
    if not usernames_clean:
        return {
            "success": True,
            "total": 0,
            "created": 0,
            "updated": 0,
            "linked_users": 0,
            "departments_created": 0,
            "positions_created": 0,
            "dismissed": 0,
            "errors": [],
        }

    if clear_before:
        # не коммитим тут отдельно: если dry_run=True, dismiss_all откатит транзакцию
        dismiss_all_ad_employees(db, dry_run=dry_run)

    server = Server(cfg.server, port=cfg.port, use_ssl=cfg.use_ssl, get_info=ALL, connect_timeout=10)
    conn = Connection(server, user=cfg.bind_dn or None, password=cfg.bind_password or None, auto_bind=True)

    attributes = [
        "cn",
        "displayName",
        "givenName",
        "sn",
        "mail",
        "userPrincipalName",
        "telephoneNumber",
        "mobile",
        "department",
        "title",
        "sAMAccountName",
        "userAccountControl",
    ]

    stats = {
        "success": True,
        "total": 0,
        "created": 0,
        "updated": 0,
        "linked_users": 0,
        "departments_created": 0,
        "positions_created": 0,
        "dismissed": 0,
        "errors": [],
    }

    try:
        # Чтобы не упереться в размер фильтра — бьём на чанки
        chunk_size = 50
        for i in range(0, len(usernames_clean), chunk_size):
            chunk = usernames_clean[i : i + chunk_size]
            or_filter = "(|" + "".join(f"(sAMAccountName={_ldap_escape(u)})" for u in chunk) + ")"
            search_filter = f"(&{cfg.user_filter}{or_filter})"

            for attrs in _paged_search(conn, cfg.base_dn, search_filter, attributes, page_size=500):
                stats["total"] += 1

                account = (_get_attr(attrs, "sAMAccountName") or "").strip()
                if not account:
                    continue

                full_name = (
                    (_get_attr(attrs, "displayName") or "").strip()
                    or (_get_attr(attrs, "cn") or "").strip()
                )
                if not full_name:
                    sn = (_get_attr(attrs, "sn") or "").strip()
                    gn = (_get_attr(attrs, "givenName") or "").strip()
                    full_name = (f"{sn} {gn}").strip()
                if not full_name:
                    continue

                email = (_get_attr(attrs, "mail") or "").strip() or (_get_attr(attrs, "userPrincipalName") or "").strip()
                phone = (_get_attr(attrs, "telephoneNumber") or "").strip() or (_get_attr(attrs, "mobile") or "").strip()
                department_name = (_get_attr(attrs, "department") or "").strip()
                title = (_get_attr(attrs, "title") or "").strip()
                enabled = _is_account_enabled(_get_attr(attrs, "userAccountControl"))

                dep, dep_created = _get_or_create_department(db, department_name)
                if dep_created:
                    stats["departments_created"] += 1

                pos, pos_created = _get_or_create_position(db, title, dep.id if dep else None)
                if pos_created:
                    stats["positions_created"] += 1

                employee = db.query(Employee).filter(Employee.external_id == account).first()
                is_new = employee is None
                if is_new:
                    employee = Employee(
                        external_id=account,
                        full_name=full_name,
                        email=email or None,
                        internal_phone=phone or None,
                        department_id=dep.id if dep else None,
                        position_id=pos.id if pos else None,
                        status="active" if enabled else "dismissed",
                    )
                    db.add(employee)
                    stats["created"] += 1
                else:
                    changed = False
                    if employee.full_name != full_name:
                        employee.full_name = full_name
                        changed = True
                    if email and employee.email != email:
                        employee.email = email
                        changed = True
                    if phone and employee.internal_phone != phone:
                        employee.internal_phone = phone
                        changed = True
                    if dep and employee.department_id != dep.id:
                        employee.department_id = dep.id
                        changed = True
                    if pos and employee.position_id != pos.id:
                        employee.position_id = pos.id
                        changed = True

                    target_status = "active" if enabled else "dismissed"
                    if employee.status != target_status and employee.status in ("active", "dismissed", "candidate"):
                        employee.status = target_status
                        changed = True
                        if target_status == "dismissed":
                            stats["dismissed"] += 1

                    if changed:
                        stats["updated"] += 1

                if email and employee.user_id is None:
                    user = db.query(User).filter(User.email == email).first()
                    if user:
                        employee.user_id = user.id
                        stats["linked_users"] += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()
    except Exception as e:
        db.rollback()
        stats["success"] = False
        stats["errors"].append(f"{type(e).__name__}: {e}")
        raise
    finally:
        try:
            conn.unbind()
        except Exception:
            pass

    return stats


def sync_employees_from_ldap(
    db: Session,
    dry_run: bool = False,
    mark_missing_dismissed: bool = False,
) -> dict:
    """
    Синхронизировать сотрудников из LDAP в HR.

    - Создаёт/обновляет Department/Position по строковым значениям.
    - Upsert в Employee по external_id = sAMAccountName.
    - Для найденных по email пользователей связывает Employee.user_id.

    ВАЖНО: По умолчанию НЕ "увольняет" (dismissed) отсутствующих в AD сотрудников.
    Это можно включить mark_missing_dismissed=True (используйте осторожно).
    """
    cfg = load_ldap_config(db)
    if not cfg.enabled:
        raise ValueError("LDAP интеграция отключена (ldap_enabled=false)")
    if not cfg.server or not cfg.base_dn:
        raise ValueError("LDAP не настроен: нужны ldap_server и ldap_base_dn")

    server = Server(cfg.server, port=cfg.port, use_ssl=cfg.use_ssl, get_info=ALL, connect_timeout=10)
    conn = Connection(server, user=cfg.bind_dn or None, password=cfg.bind_password or None, auto_bind=True)

    attributes = [
        "cn",
        "displayName",
        "givenName",
        "sn",
        "mail",
        "userPrincipalName",
        "telephoneNumber",
        "mobile",
        "department",
        "title",
        "sAMAccountName",
        "userAccountControl",
    ]

    stats = {
        "success": True,
        "total": 0,
        "created": 0,
        "updated": 0,
        "linked_users": 0,
        "departments_created": 0,
        "positions_created": 0,
        "dismissed": 0,
        "errors": [],
    }

    seen_external_ids: set[str] = set()

    try:
        for attrs in _paged_search(conn, cfg.base_dn, cfg.user_filter, attributes, page_size=500):
            stats["total"] += 1

            account = (_get_attr(attrs, "sAMAccountName") or "").strip()
            if not account:
                continue
            seen_external_ids.add(account.lower())

            # Имя
            full_name = (
                (_get_attr(attrs, "displayName") or "").strip()
                or (_get_attr(attrs, "cn") or "").strip()
            )
            if not full_name:
                # fallback: SN + givenName
                sn = (_get_attr(attrs, "sn") or "").strip()
                gn = (_get_attr(attrs, "givenName") or "").strip()
                full_name = (f"{sn} {gn}").strip()
            if not full_name:
                continue

            email = (_get_attr(attrs, "mail") or "").strip() or (_get_attr(attrs, "userPrincipalName") or "").strip()
            phone = (_get_attr(attrs, "telephoneNumber") or "").strip() or (_get_attr(attrs, "mobile") or "").strip()
            department_name = (_get_attr(attrs, "department") or "").strip()
            title = (_get_attr(attrs, "title") or "").strip()
            enabled = _is_account_enabled(_get_attr(attrs, "userAccountControl"))

            dep, dep_created = _get_or_create_department(db, department_name)
            if dep_created:
                stats["departments_created"] += 1

            pos, pos_created = _get_or_create_position(db, title, dep.id if dep else None)
            if pos_created:
                stats["positions_created"] += 1

            employee = db.query(Employee).filter(Employee.external_id == account).first()
            is_new = employee is None
            if is_new:
                employee = Employee(
                    external_id=account,
                    full_name=full_name,
                    email=email or None,
                    internal_phone=phone or None,
                    department_id=dep.id if dep else None,
                    position_id=pos.id if pos else None,
                    status="active" if enabled else "dismissed",
                )
                db.add(employee)
                stats["created"] += 1
            else:
                changed = False
                if employee.full_name != full_name:
                    employee.full_name = full_name
                    changed = True
                if email and employee.email != email:
                    employee.email = email
                    changed = True
                if phone and employee.internal_phone != phone:
                    employee.internal_phone = phone
                    changed = True
                if dep and employee.department_id != dep.id:
                    employee.department_id = dep.id
                    changed = True
                if pos and employee.position_id != pos.id:
                    employee.position_id = pos.id
                    changed = True

                # статус обновляем только если он candidate/active/dismissed
                target_status = "active" if enabled else "dismissed"
                if employee.status != target_status and employee.status in ("active", "dismissed", "candidate"):
                    employee.status = target_status
                    changed = True
                    if target_status == "dismissed":
                        stats["dismissed"] += 1

                if changed:
                    stats["updated"] += 1

            # Привязка к User по email (если есть)
            if email and employee.user_id is None:
                user = db.query(User).filter(User.email == email).first()
                if user:
                    employee.user_id = user.id
                    stats["linked_users"] += 1

        # Отметить отсутствующих в AD как dismissed (опасно, выключено по умолчанию)
        if mark_missing_dismissed:
            all_emps = db.query(Employee).filter(Employee.external_id.isnot(None)).all()
            for e in all_emps:
                ext = (e.external_id or "").strip().lower()
                if not ext:
                    continue
                if ext not in seen_external_ids and e.status != "dismissed":
                    e.status = "dismissed"
                    stats["dismissed"] += 1

        if dry_run:
            db.rollback()
        else:
            db.commit()
    except Exception as e:
        db.rollback()
        stats["success"] = False
        stats["errors"].append(f"{type(e).__name__}: {e}")
        raise
    finally:
        try:
            conn.unbind()
        except Exception:
            pass

    return stats

