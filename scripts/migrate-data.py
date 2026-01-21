#!/usr/bin/env python3
"""
Elements Platform - Миграция данных из SQLite в PostgreSQL

Использование:
    python scripts/migrate-data.py --sqlite-path /path/to/hr_desk.db --pg-url postgresql://user:pass@host:5432/db

Этот скрипт:
1. Читает данные из старой SQLite базы
2. Преобразует их в новый формат (UUID для users, JSONB для roles)
3. Записывает в PostgreSQL
"""

import argparse
import json
import sqlite3
import uuid
from datetime import datetime
from typing import Any

import psycopg2
from psycopg2.extras import execute_values


def log_info(msg: str):
    print(f"[INFO] {msg}")


def log_success(msg: str):
    print(f"[OK] {msg}")


def log_error(msg: str):
    print(f"[ERROR] {msg}")


def connect_sqlite(path: str) -> sqlite3.Connection:
    """Подключение к SQLite"""
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def connect_postgres(url: str):
    """Подключение к PostgreSQL"""
    return psycopg2.connect(url)


def get_sqlite_tables(conn: sqlite3.Connection) -> list[str]:
    """Получить список таблиц в SQLite"""
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return [row[0] for row in cursor.fetchall()]


def migrate_users(sqlite_conn: sqlite3.Connection, pg_conn) -> dict[int, str]:
    """
    Миграция пользователей.
    Возвращает маппинг старых ID (int) -> новых ID (uuid)
    """
    log_info("Миграция пользователей...")

    cursor = sqlite_conn.execute("SELECT * FROM users")
    rows = cursor.fetchall()

    if not rows:
        log_info("Таблица users пуста")
        return {}

    id_mapping = {}
    pg_cursor = pg_conn.cursor()

    for row in rows:
        old_id = row["id"]
        new_id = str(uuid.uuid4())
        id_mapping[old_id] = new_id

        # Преобразуем role в roles JSONB
        old_role = row["role"] if "role" in row.keys() else "auditor"
        roles = {"hr": old_role}

        # Определяем is_superuser
        is_superuser = old_role == "admin"

        # Email из username если нет отдельного поля
        email = row["username"]
        if "@" not in email:
            email = f"{email}@elements.local"

        pg_cursor.execute(
            """
            INSERT INTO users (id, email, username, password_hash, full_name, roles, is_active, is_superuser, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                roles = EXCLUDED.roles,
                updated_at = NOW()
        """,
            (
                new_id,
                email,
                row["username"],
                row["hashed_password"]
                if "hashed_password" in row.keys()
                else row.get("password_hash"),
                row["full_name"] if "full_name" in row.keys() else row["username"],
                json.dumps(roles),
                True,
                is_superuser,
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )

    pg_conn.commit()
    log_success(f"Мигрировано {len(rows)} пользователей")

    return id_mapping


def migrate_departments(sqlite_conn: sqlite3.Connection, pg_conn):
    """Миграция отделов"""
    log_info("Миграция отделов...")

    cursor = sqlite_conn.execute("SELECT * FROM departments")
    rows = cursor.fetchall()

    if not rows:
        log_info("Таблица departments пуста")
        return

    pg_cursor = pg_conn.cursor()

    for row in rows:
        pg_cursor.execute(
            """
            INSERT INTO departments (id, name, parent_department_id, manager_id, external_id, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                parent_department_id = EXCLUDED.parent_department_id,
                manager_id = EXCLUDED.manager_id,
                external_id = EXCLUDED.external_id,
                updated_at = NOW()
        """,
            (
                row["id"],
                row["name"],
                row["parent_department_id"]
                if "parent_department_id" in row.keys()
                else None,
                row["manager_id"] if "manager_id" in row.keys() else None,
                row["external_id"] if "external_id" in row.keys() else None,
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )

    # Сбрасываем sequence
    pg_cursor.execute(
        "SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments))"
    )

    pg_conn.commit()
    log_success(f"Мигрировано {len(rows)} отделов")


def migrate_positions(sqlite_conn: sqlite3.Connection, pg_conn):
    """Миграция должностей"""
    log_info("Миграция должностей...")

    cursor = sqlite_conn.execute("SELECT * FROM positions")
    rows = cursor.fetchall()

    if not rows:
        log_info("Таблица positions пуста")
        return

    pg_cursor = pg_conn.cursor()

    for row in rows:
        pg_cursor.execute(
            """
            INSERT INTO positions (id, name, access_template, department_id, external_id, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                access_template = EXCLUDED.access_template,
                department_id = EXCLUDED.department_id,
                external_id = EXCLUDED.external_id,
                updated_at = NOW()
        """,
            (
                row["id"],
                row["name"],
                row["access_template"] if "access_template" in row.keys() else None,
                row["department_id"] if "department_id" in row.keys() else None,
                row["external_id"] if "external_id" in row.keys() else None,
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )

    pg_cursor.execute(
        "SELECT setval('positions_id_seq', (SELECT MAX(id) FROM positions))"
    )

    pg_conn.commit()
    log_success(f"Мигрировано {len(rows)} должностей")


def migrate_employees(sqlite_conn: sqlite3.Connection, pg_conn):
    """Миграция сотрудников"""
    log_info("Миграция сотрудников...")

    cursor = sqlite_conn.execute("SELECT * FROM employees")
    rows = cursor.fetchall()

    if not rows:
        log_info("Таблица employees пуста")
        return

    pg_cursor = pg_conn.cursor()

    for row in rows:
        pg_cursor.execute(
            """
            INSERT INTO employees (
                id, full_name, position_id, department_id, manager_id,
                internal_phone, external_phone, email, birthday, status,
                uses_it_equipment, external_id, pass_number, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                position_id = EXCLUDED.position_id,
                department_id = EXCLUDED.department_id,
                updated_at = NOW()
        """,
            (
                row["id"],
                row["full_name"],
                row["position_id"] if "position_id" in row.keys() else None,
                row["department_id"] if "department_id" in row.keys() else None,
                row["manager_id"] if "manager_id" in row.keys() else None,
                row["internal_phone"] if "internal_phone" in row.keys() else None,
                row["external_phone"] if "external_phone" in row.keys() else None,
                row["email"] if "email" in row.keys() else None,
                row["birthday"] if "birthday" in row.keys() else None,
                row["status"] if "status" in row.keys() else "active",
                row["uses_it_equipment"]
                if "uses_it_equipment" in row.keys()
                else False,
                row["external_id"] if "external_id" in row.keys() else None,
                row["pass_number"] if "pass_number" in row.keys() else None,
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )

    pg_cursor.execute(
        "SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees))"
    )

    pg_conn.commit()
    log_success(f"Мигрировано {len(rows)} сотрудников")


def migrate_hr_requests(sqlite_conn: sqlite3.Connection, pg_conn):
    """Миграция HR-заявок"""
    log_info("Миграция HR-заявок...")

    cursor = sqlite_conn.execute("SELECT * FROM hr_requests")
    rows = cursor.fetchall()

    if not rows:
        log_info("Таблица hr_requests пуста")
        return

    pg_cursor = pg_conn.cursor()

    for row in rows:
        pg_cursor.execute(
            """
            INSERT INTO hr_requests (
                id, type, employee_id, request_date, effective_date,
                status, needs_it_equipment, pass_number, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                updated_at = NOW()
        """,
            (
                row["id"],
                row["type"],
                row["employee_id"],
                row["request_date"],
                row["effective_date"] if "effective_date" in row.keys() else None,
                row["status"] if "status" in row.keys() else "new",
                row["needs_it_equipment"]
                if "needs_it_equipment" in row.keys()
                else False,
                row["pass_number"] if "pass_number" in row.keys() else None,
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )

    pg_cursor.execute(
        "SELECT setval('hr_requests_id_seq', (SELECT MAX(id) FROM hr_requests))"
    )

    pg_conn.commit()
    log_success(f"Мигрировано {len(rows)} HR-заявок")


def migrate_it_accounts(sqlite_conn: sqlite3.Connection, pg_conn):
    """Миграция IT-учёток"""
    log_info("Миграция IT-учёток...")

    cursor = sqlite_conn.execute("SELECT * FROM it_accounts")
    rows = cursor.fetchall()

    if not rows:
        log_info("Таблица it_accounts пуста")
        return

    pg_cursor = pg_conn.cursor()

    for row in rows:
        pg_cursor.execute(
            """
            INSERT INTO it_accounts (
                id, employee_id, ad_account, mailcow_account,
                messenger_account, status, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                status = EXCLUDED.status,
                updated_at = NOW()
        """,
            (
                row["id"],
                row["employee_id"],
                row["ad_account"] if "ad_account" in row.keys() else None,
                row["mailcow_account"] if "mailcow_account" in row.keys() else None,
                row["messenger_account"] if "messenger_account" in row.keys() else None,
                row["status"] if "status" in row.keys() else "active",
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )

    pg_cursor.execute(
        "SELECT setval('it_accounts_id_seq', (SELECT MAX(id) FROM it_accounts))"
    )

    pg_conn.commit()
    log_success(f"Мигрировано {len(rows)} IT-учёток")


def migrate_system_settings(sqlite_conn: sqlite3.Connection, pg_conn):
    """Миграция системных настроек"""
    log_info("Миграция системных настроек...")

    cursor = sqlite_conn.execute("SELECT * FROM system_settings")
    rows = cursor.fetchall()

    if not rows:
        log_info("Таблица system_settings пуста")
        return

    pg_cursor = pg_conn.cursor()

    for row in rows:
        pg_cursor.execute(
            """
            INSERT INTO system_settings (
                id, setting_key, setting_value, setting_type, description, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (setting_key) DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                updated_at = NOW()
        """,
            (
                row["id"],
                row["setting_key"],
                row["setting_value"] if "setting_value" in row.keys() else None,
                row["setting_type"] if "setting_type" in row.keys() else "general",
                row["description"] if "description" in row.keys() else None,
                datetime.utcnow(),
                datetime.utcnow(),
            ),
        )

    pg_cursor.execute(
        "SELECT setval('system_settings_id_seq', (SELECT MAX(id) FROM system_settings))"
    )

    pg_conn.commit()
    log_success(f"Мигрировано {len(rows)} настроек")


def main():
    parser = argparse.ArgumentParser(
        description="Миграция данных из SQLite в PostgreSQL"
    )
    parser.add_argument(
        "--sqlite-path", required=True, help="Путь к SQLite базе данных"
    )
    parser.add_argument("--pg-url", required=True, help="PostgreSQL connection URL")
    parser.add_argument(
        "--dry-run", action="store_true", help="Только показать что будет сделано"
    )

    args = parser.parse_args()

    log_info(f"SQLite: {args.sqlite_path}")
    log_info(
        f"PostgreSQL: {args.pg_url.split('@')[1] if '@' in args.pg_url else args.pg_url}"
    )

    if args.dry_run:
        log_info("Режим dry-run: изменения не будут сохранены")

    # Подключаемся
    sqlite_conn = connect_sqlite(args.sqlite_path)
    pg_conn = connect_postgres(args.pg_url)

    # Показываем таблицы в SQLite
    tables = get_sqlite_tables(sqlite_conn)
    log_info(f"Найдены таблицы в SQLite: {', '.join(tables)}")

    try:
        # Миграция в правильном порядке (с учётом FK)
        migrate_users(sqlite_conn, pg_conn)
        migrate_departments(sqlite_conn, pg_conn)
        migrate_positions(sqlite_conn, pg_conn)
        migrate_employees(sqlite_conn, pg_conn)
        migrate_hr_requests(sqlite_conn, pg_conn)
        migrate_it_accounts(sqlite_conn, pg_conn)
        migrate_system_settings(sqlite_conn, pg_conn)

        if args.dry_run:
            pg_conn.rollback()
            log_info("Dry-run завершён, изменения отменены")
        else:
            pg_conn.commit()
            log_success("Миграция успешно завершена!")

    except Exception as e:
        pg_conn.rollback()
        log_error(f"Ошибка миграции: {e}")
        raise
    finally:
        sqlite_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    main()
