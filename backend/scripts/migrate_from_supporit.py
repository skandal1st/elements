#!/usr/bin/env python3
"""
Скрипт миграции данных из SuppOrIT в Elements Platform.

Использование:
    python scripts/migrate_from_supporit.py --source-db "postgresql://user:pass@host:5432/supporit"

Или через переменные окружения:
    export SUPPORIT_DATABASE_URL="postgresql://user:pass@host:5432/supporit"
    python scripts/migrate_from_supporit.py

Опции:
    --source-db     URL базы данных SuppOrIT
    --dry-run       Только проверка, без записи данных
    --skip-users    Пропустить миграцию пользователей (если уже есть)
    --verbose       Подробный вывод

Мигрируемые таблицы:
    - users              -> users
    - buildings          -> buildings
    - rooms              -> rooms
    - equipment          -> equipment
    - equipment_history  -> equipment_history
    - tickets            -> tickets
    - ticket_comments    -> ticket_comments
    - ticket_history     -> ticket_history
    - consumables        -> consumables
    - consumable_issues  -> consumable_issues
    - software_licenses  -> software_licenses
    - license_assignments-> license_assignments
    - equipment_requests -> equipment_requests
    - dictionaries       -> dictionaries
    - notifications      -> notifications

НЕ мигрируемые таблицы (не реализованы в Elements):
    - maintenance        - плановое обслуживание оборудования
    - knowledge_base     - база знаний
    - system_settings    - системные настройки
    - telegram_link_codes- коды привязки Telegram
    - schema_migrations  - миграции БД
    - update_logs        - логи обновлений
    - system_info        - информация о системе

Примечания:
    - UUID сохраняются как есть для совместимости
    - Поля current_owner_id в equipment и equipment_history
      требуют ручного маппинга (supporit: user UUID -> Elements: employee int)
    - Поля department, position, telegram_* из users не мигрируются
      (отсутствуют в модели User Elements)
"""

import argparse
import os
import sys
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Добавляем путь к backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.database import engine as target_engine, SessionLocal
from backend.modules.it.models import (
    Building,
    Room,
    Equipment,
    EquipmentHistory,
    Ticket,
    TicketComment,
    TicketHistory,
    Consumable,
    ConsumableIssue,
    SoftwareLicense,
    LicenseAssignment,
    EquipmentRequest,
    Dictionary,
    Notification,
)
from backend.modules.hr.models.user import User


class MigrationStats:
    """Статистика миграции"""
    def __init__(self):
        self.tables = {}

    def add(self, table: str, created: int = 0, skipped: int = 0, errors: int = 0):
        if table not in self.tables:
            self.tables[table] = {"created": 0, "skipped": 0, "errors": 0}
        self.tables[table]["created"] += created
        self.tables[table]["skipped"] += skipped
        self.tables[table]["errors"] += errors

    def print_summary(self):
        print("\n" + "=" * 60)
        print("ИТОГИ МИГРАЦИИ")
        print("=" * 60)
        total_created = 0
        total_skipped = 0
        total_errors = 0
        for table, stats in self.tables.items():
            print(f"{table:25} | создано: {stats['created']:5} | пропущено: {stats['skipped']:5} | ошибок: {stats['errors']:5}")
            total_created += stats["created"]
            total_skipped += stats["skipped"]
            total_errors += stats["errors"]
        print("-" * 60)
        print(f"{'ВСЕГО':25} | создано: {total_created:5} | пропущено: {total_skipped:5} | ошибок: {total_errors:5}")
        print("=" * 60)


def log(message: str, verbose: bool = True):
    """Логирование с временной меткой"""
    if verbose:
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")


def fetch_all(source_session, query: str) -> list[dict]:
    """Получить все записи из источника"""
    result = source_session.execute(text(query))
    columns = result.keys()
    return [dict(zip(columns, row)) for row in result.fetchall()]


def migrate_users(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция пользователей"""
    log("Миграция пользователей...", verbose)

    users = fetch_all(source_session, """
        SELECT id, email, full_name, password_hash, role, department, position,
               phone, avatar_url, telegram_id, telegram_username, telegram_linked_at,
               telegram_notifications, ad_username, created_at, updated_at
        FROM users
        ORDER BY created_at
    """)

    for u in users:
        try:
            # Проверяем существование по email
            existing = target_session.query(User).filter(User.email == u["email"]).first()
            if existing:
                stats.add("users", skipped=1)
                continue

            # Маппинг ролей supporit -> Elements
            role_mapping = {
                "admin": {"hr": "admin", "it": "admin"},
                "it_specialist": {"it": "admin"},
                "employee": {"it": "user"},
            }
            roles = role_mapping.get(u["role"], {"it": "user"})

            if not dry_run:
                # Создаём пользователя с полями, которые есть в модели User
                user = User(
                    id=u["id"],
                    email=u["email"],
                    username=u["email"].split("@")[0],
                    full_name=u["full_name"],
                    password_hash=u["password_hash"],
                    roles=roles,
                    is_superuser=(u["role"] == "admin"),
                    is_active=True,
                    phone=u["phone"],
                    avatar_url=u["avatar_url"],
                    created_at=u["created_at"],
                    updated_at=u["updated_at"],
                )
                target_session.add(user)

            stats.add("users", created=1)
        except Exception as e:
            log(f"  Ошибка пользователя {u['email']}: {e}", verbose)
            stats.add("users", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Пользователи: {stats.tables.get('users', {})}", verbose)


def migrate_buildings(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция зданий"""
    log("Миграция зданий...", verbose)

    buildings = fetch_all(source_session, """
        SELECT id, name, address, description, is_active, created_at, updated_at
        FROM buildings
        ORDER BY created_at
    """)

    for b in buildings:
        try:
            existing = target_session.query(Building).filter(Building.id == b["id"]).first()
            if existing:
                stats.add("buildings", skipped=1)
                continue

            if not dry_run:
                building = Building(
                    id=b["id"],
                    name=b["name"],
                    address=b["address"],
                    description=b["description"],
                    is_active=b["is_active"] if b["is_active"] is not None else True,
                    created_at=b["created_at"],
                    updated_at=b["updated_at"],
                )
                target_session.add(building)

            stats.add("buildings", created=1)
        except Exception as e:
            log(f"  Ошибка здания {b['name']}: {e}", verbose)
            stats.add("buildings", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Здания: {stats.tables.get('buildings', {})}", verbose)


def migrate_rooms(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция комнат"""
    log("Миграция комнат...", verbose)

    rooms = fetch_all(source_session, """
        SELECT id, building_id, name, floor, description, is_active, created_at, updated_at
        FROM rooms
        ORDER BY created_at
    """)

    for r in rooms:
        try:
            existing = target_session.query(Room).filter(Room.id == r["id"]).first()
            if existing:
                stats.add("rooms", skipped=1)
                continue

            if not dry_run:
                room = Room(
                    id=r["id"],
                    building_id=r["building_id"],
                    name=r["name"],
                    floor=r["floor"],
                    description=r["description"],
                    is_active=r["is_active"] if r["is_active"] is not None else True,
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                )
                target_session.add(room)

            stats.add("rooms", created=1)
        except Exception as e:
            log(f"  Ошибка комнаты {r['name']}: {e}", verbose)
            stats.add("rooms", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Комнаты: {stats.tables.get('rooms', {})}", verbose)


def migrate_equipment(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция оборудования"""
    log("Миграция оборудования...", verbose)

    equipment_list = fetch_all(source_session, """
        SELECT id, name, model, inventory_number, serial_number, category, status,
               purchase_date, cost, warranty_until, current_owner_id,
               location_department, location_room, manufacturer, ip_address,
               specifications, attachments, qr_code, created_at, updated_at
        FROM equipment
        ORDER BY created_at
    """)

    for e in equipment_list:
        try:
            existing = target_session.query(Equipment).filter(Equipment.id == e["id"]).first()
            if existing:
                stats.add("equipment", skipped=1)
                continue

            # current_owner_id в supporit - это UUID пользователя
            # В Elements это int (employee.id), поэтому оставляем NULL
            # и потом можно смаппить вручную

            if not dry_run:
                eq = Equipment(
                    id=e["id"],
                    name=e["name"],
                    model=e["model"],
                    inventory_number=e["inventory_number"],
                    serial_number=e["serial_number"],
                    category=e["category"] or "other",
                    status=e["status"] or "in_stock",
                    purchase_date=e["purchase_date"],
                    cost=e["cost"],
                    warranty_until=e["warranty_until"],
                    current_owner_id=None,  # Требует маппинга user_id -> employee_id
                    location_department=e["location_department"],
                    location_room=e["location_room"],
                    manufacturer=e["manufacturer"],
                    ip_address=e["ip_address"],
                    specifications=e["specifications"],
                    attachments=e["attachments"],
                    qr_code=e["qr_code"],
                    created_at=e["created_at"],
                    updated_at=e["updated_at"],
                )
                target_session.add(eq)

            stats.add("equipment", created=1)
        except Exception as e:
            log(f"  Ошибка оборудования {e}: {e}", verbose)
            stats.add("equipment", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Оборудование: {stats.tables.get('equipment', {})}", verbose)


def migrate_tickets(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция тикетов"""
    log("Миграция тикетов...", verbose)

    tickets = fetch_all(source_session, """
        SELECT id, title, description, category, priority, status,
               creator_id, assignee_id, equipment_id, attachments,
               desired_resolution_date, resolved_at, closed_at,
               rating, rating_comment, email_sender, created_via,
               email_message_id, created_at, updated_at
        FROM tickets
        ORDER BY created_at
    """)

    for t in tickets:
        try:
            existing = target_session.query(Ticket).filter(Ticket.id == t["id"]).first()
            if existing:
                stats.add("tickets", skipped=1)
                continue

            # Маппинг created_via -> source
            source_mapping = {
                "web": "web",
                "email": "email",
                "api": "api",
            }
            source = source_mapping.get(t["created_via"], "web")

            if not dry_run:
                ticket = Ticket(
                    id=t["id"],
                    title=t["title"],
                    description=t["description"],
                    category=t["category"] or "other",
                    priority=t["priority"] or "medium",
                    status=t["status"] or "new",
                    creator_id=t["creator_id"],
                    assignee_id=t["assignee_id"],
                    equipment_id=t["equipment_id"],
                    attachments=t["attachments"],
                    desired_resolution_date=t["desired_resolution_date"],
                    resolved_at=t["resolved_at"],
                    closed_at=t["closed_at"],
                    rating=t["rating"],
                    rating_comment=t["rating_comment"],
                    source=source,
                    email_sender=t["email_sender"],
                    email_message_id=t["email_message_id"],
                    created_at=t["created_at"],
                    updated_at=t["updated_at"],
                )
                target_session.add(ticket)

            stats.add("tickets", created=1)
        except Exception as e:
            log(f"  Ошибка тикета {t['id']}: {e}", verbose)
            stats.add("tickets", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Тикеты: {stats.tables.get('tickets', {})}", verbose)


def migrate_ticket_comments(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция комментариев к тикетам"""
    log("Миграция комментариев...", verbose)

    comments = fetch_all(source_session, """
        SELECT id, ticket_id, user_id, content, attachments, created_at
        FROM ticket_comments
        ORDER BY created_at
    """)

    for c in comments:
        try:
            existing = target_session.query(TicketComment).filter(TicketComment.id == c["id"]).first()
            if existing:
                stats.add("ticket_comments", skipped=1)
                continue

            # Пропускаем комментарии без user_id (email комментарии без привязки)
            if not c["user_id"]:
                stats.add("ticket_comments", skipped=1)
                continue

            if not dry_run:
                comment = TicketComment(
                    id=c["id"],
                    ticket_id=c["ticket_id"],
                    user_id=c["user_id"],
                    content=c["content"],
                    attachments=c["attachments"],
                    created_at=c["created_at"],
                )
                target_session.add(comment)

            stats.add("ticket_comments", created=1)
        except Exception as e:
            log(f"  Ошибка комментария {c['id']}: {e}", verbose)
            stats.add("ticket_comments", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Комментарии: {stats.tables.get('ticket_comments', {})}", verbose)


def migrate_ticket_history(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция истории тикетов"""
    log("Миграция истории тикетов...", verbose)

    history = fetch_all(source_session, """
        SELECT id, ticket_id, changed_by_id, field, old_value, new_value, created_at
        FROM ticket_history
        ORDER BY created_at
    """)

    for h in history:
        try:
            existing = target_session.query(TicketHistory).filter(TicketHistory.id == h["id"]).first()
            if existing:
                stats.add("ticket_history", skipped=1)
                continue

            if not dry_run:
                hist = TicketHistory(
                    id=h["id"],
                    ticket_id=h["ticket_id"],
                    changed_by_id=h["changed_by_id"],
                    field=h["field"],
                    old_value=h["old_value"],
                    new_value=h["new_value"],
                    created_at=h["created_at"],
                )
                target_session.add(hist)

            stats.add("ticket_history", created=1)
        except Exception as e:
            log(f"  Ошибка истории {h['id']}: {e}", verbose)
            stats.add("ticket_history", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  История тикетов: {stats.tables.get('ticket_history', {})}", verbose)


def migrate_equipment_history(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция истории оборудования"""
    log("Миграция истории оборудования...", verbose)

    history = fetch_all(source_session, """
        SELECT id, equipment_id, from_user_id, to_user_id, from_location,
               to_location, reason, changed_by_id, created_at
        FROM equipment_history
        ORDER BY created_at
    """)

    for h in history:
        try:
            existing = target_session.query(EquipmentHistory).filter(EquipmentHistory.id == h["id"]).first()
            if existing:
                stats.add("equipment_history", skipped=1)
                continue

            # from_user_id и to_user_id в supporit - это UUID пользователей
            # В Elements это int (employee.id), поэтому оставляем NULL

            if not dry_run:
                hist = EquipmentHistory(
                    id=h["id"],
                    equipment_id=h["equipment_id"],
                    from_user_id=None,  # Требует маппинга
                    to_user_id=None,    # Требует маппинга
                    from_location=h["from_location"],
                    to_location=h["to_location"],
                    reason=h["reason"],
                    changed_by_id=h["changed_by_id"],
                    created_at=h["created_at"],
                )
                target_session.add(hist)

            stats.add("equipment_history", created=1)
        except Exception as e:
            log(f"  Ошибка истории оборудования {h['id']}: {e}", verbose)
            stats.add("equipment_history", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  История оборудования: {stats.tables.get('equipment_history', {})}", verbose)


def migrate_consumables(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция расходных материалов"""
    log("Миграция расходных материалов...", verbose)

    consumables = fetch_all(source_session, """
        SELECT id, name, category, unit, quantity_in_stock, min_quantity,
               cost_per_unit, supplier, last_purchase_date, created_at, updated_at
        FROM consumables
        ORDER BY created_at
    """)

    for c in consumables:
        try:
            existing = target_session.query(Consumable).filter(Consumable.id == c["id"]).first()
            if existing:
                stats.add("consumables", skipped=1)
                continue

            if not dry_run:
                cons = Consumable(
                    id=c["id"],
                    name=c["name"],
                    category=c["category"],
                    unit=c["unit"] or "шт",
                    quantity_in_stock=c["quantity_in_stock"] or 0,
                    min_quantity=c["min_quantity"] or 0,
                    cost_per_unit=c["cost_per_unit"],
                    supplier=c["supplier"],
                    last_purchase_date=c["last_purchase_date"],
                    created_at=c["created_at"],
                    updated_at=c["updated_at"],
                )
                target_session.add(cons)

            stats.add("consumables", created=1)
        except Exception as e:
            log(f"  Ошибка расходника {c['name']}: {e}", verbose)
            stats.add("consumables", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Расходные материалы: {stats.tables.get('consumables', {})}", verbose)


def migrate_consumable_issues(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция выдачи расходных материалов"""
    log("Миграция выдачи расходников...", verbose)

    issues = fetch_all(source_session, """
        SELECT id, consumable_id, quantity, issued_to_id, issued_by_id, reason, created_at
        FROM consumable_issues
        ORDER BY created_at
    """)

    for i in issues:
        try:
            existing = target_session.query(ConsumableIssue).filter(ConsumableIssue.id == i["id"]).first()
            if existing:
                stats.add("consumable_issues", skipped=1)
                continue

            if not dry_run:
                issue = ConsumableIssue(
                    id=i["id"],
                    consumable_id=i["consumable_id"],
                    quantity=i["quantity"],
                    issued_to_id=i["issued_to_id"],
                    issued_by_id=i["issued_by_id"],
                    reason=i["reason"],
                    created_at=i["created_at"],
                )
                target_session.add(issue)

            stats.add("consumable_issues", created=1)
        except Exception as e:
            log(f"  Ошибка выдачи {i['id']}: {e}", verbose)
            stats.add("consumable_issues", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Выдача расходников: {stats.tables.get('consumable_issues', {})}", verbose)


def migrate_software_licenses(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция лицензий ПО"""
    log("Миграция лицензий ПО...", verbose)

    licenses = fetch_all(source_session, """
        SELECT id, software_name, vendor, license_type, license_key, total_licenses,
               used_licenses, expires_at, cost, purchase_date, notes, created_at, updated_at
        FROM software_licenses
        ORDER BY created_at
    """)

    for l in licenses:
        try:
            existing = target_session.query(SoftwareLicense).filter(SoftwareLicense.id == l["id"]).first()
            if existing:
                stats.add("software_licenses", skipped=1)
                continue

            if not dry_run:
                lic = SoftwareLicense(
                    id=l["id"],
                    software_name=l["software_name"],
                    vendor=l["vendor"],
                    license_type=l["license_type"],
                    license_key=l["license_key"],
                    total_licenses=l["total_licenses"] or 1,
                    used_licenses=l["used_licenses"] or 0,
                    expires_at=l["expires_at"],
                    cost=l["cost"],
                    purchase_date=l["purchase_date"],
                    notes=l["notes"],
                    created_at=l["created_at"],
                    updated_at=l["updated_at"],
                )
                target_session.add(lic)

            stats.add("software_licenses", created=1)
        except Exception as e:
            log(f"  Ошибка лицензии {l['software_name']}: {e}", verbose)
            stats.add("software_licenses", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Лицензии ПО: {stats.tables.get('software_licenses', {})}", verbose)


def migrate_license_assignments(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция назначений лицензий"""
    log("Миграция назначений лицензий...", verbose)

    assignments = fetch_all(source_session, """
        SELECT id, license_id, equipment_id, user_id, assigned_at, released_at
        FROM license_assignments
        ORDER BY assigned_at
    """)

    for a in assignments:
        try:
            existing = target_session.query(LicenseAssignment).filter(LicenseAssignment.id == a["id"]).first()
            if existing:
                stats.add("license_assignments", skipped=1)
                continue

            if not dry_run:
                assign = LicenseAssignment(
                    id=a["id"],
                    license_id=a["license_id"],
                    equipment_id=a["equipment_id"],
                    user_id=a["user_id"],
                    assigned_at=a["assigned_at"],
                    released_at=a["released_at"],
                )
                target_session.add(assign)

            stats.add("license_assignments", created=1)
        except Exception as e:
            log(f"  Ошибка назначения {a['id']}: {e}", verbose)
            stats.add("license_assignments", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Назначения лицензий: {stats.tables.get('license_assignments', {})}", verbose)


def migrate_equipment_requests(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция заявок на оборудование"""
    log("Миграция заявок на оборудование...", verbose)

    requests = fetch_all(source_session, """
        SELECT id, title, description, equipment_category, request_type, quantity,
               urgency, justification, status, requester_id, reviewer_id,
               replace_equipment_id, issued_equipment_id, estimated_cost,
               review_comment, reviewed_at, ordered_at, received_at, issued_at,
               created_at, updated_at
        FROM equipment_requests
        ORDER BY created_at
    """)

    for r in requests:
        try:
            existing = target_session.query(EquipmentRequest).filter(EquipmentRequest.id == r["id"]).first()
            if existing:
                stats.add("equipment_requests", skipped=1)
                continue

            if not dry_run:
                req = EquipmentRequest(
                    id=r["id"],
                    title=r["title"],
                    description=r["description"],
                    equipment_category=r["equipment_category"],
                    request_type=r["request_type"] or "new",
                    quantity=r["quantity"] or 1,
                    urgency=r["urgency"] or "normal",
                    justification=r["justification"],
                    status=r["status"] or "pending",
                    requester_id=r["requester_id"],
                    reviewer_id=r["reviewer_id"],
                    replace_equipment_id=r["replace_equipment_id"],
                    issued_equipment_id=r["issued_equipment_id"],
                    estimated_cost=r["estimated_cost"],
                    review_comment=r["review_comment"],
                    reviewed_at=r["reviewed_at"],
                    ordered_at=r["ordered_at"],
                    received_at=r["received_at"],
                    issued_at=r["issued_at"],
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                )
                target_session.add(req)

            stats.add("equipment_requests", created=1)
        except Exception as e:
            log(f"  Ошибка заявки {r['id']}: {e}", verbose)
            stats.add("equipment_requests", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Заявки на оборудование: {stats.tables.get('equipment_requests', {})}", verbose)


def migrate_dictionaries(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция справочников"""
    log("Миграция справочников...", verbose)

    dictionaries = fetch_all(source_session, """
        SELECT id, dictionary_type, key, label, color, icon, sort_order,
               is_active, is_system, created_at, updated_at
        FROM dictionaries
        ORDER BY dictionary_type, sort_order
    """)

    for d in dictionaries:
        try:
            existing = target_session.query(Dictionary).filter(Dictionary.id == d["id"]).first()
            if existing:
                stats.add("dictionaries", skipped=1)
                continue

            if not dry_run:
                dic = Dictionary(
                    id=d["id"],
                    dictionary_type=d["dictionary_type"],
                    key=d["key"],
                    label=d["label"],
                    color=d["color"],
                    icon=d["icon"],
                    sort_order=d["sort_order"] or 0,
                    is_active=d["is_active"] if d["is_active"] is not None else True,
                    is_system=d["is_system"] if d["is_system"] is not None else False,
                    created_at=d["created_at"],
                    updated_at=d["updated_at"],
                )
                target_session.add(dic)

            stats.add("dictionaries", created=1)
        except Exception as e:
            log(f"  Ошибка справочника {d['key']}: {e}", verbose)
            stats.add("dictionaries", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Справочники: {stats.tables.get('dictionaries', {})}", verbose)


def migrate_notifications(source_session, target_session, stats: MigrationStats, dry_run: bool, verbose: bool):
    """Миграция уведомлений"""
    log("Миграция уведомлений...", verbose)

    notifications = fetch_all(source_session, """
        SELECT id, user_id, title, message, type, related_type, related_id,
               is_read, created_at
        FROM notifications
        ORDER BY created_at
    """)

    for n in notifications:
        try:
            existing = target_session.query(Notification).filter(Notification.id == n["id"]).first()
            if existing:
                stats.add("notifications", skipped=1)
                continue

            if not dry_run:
                notif = Notification(
                    id=n["id"],
                    user_id=n["user_id"],
                    title=n["title"],
                    message=n["message"],
                    type=n["type"] or "info",
                    related_type=n["related_type"],
                    related_id=n["related_id"],
                    is_read=n["is_read"] if n["is_read"] is not None else False,
                    created_at=n["created_at"],
                )
                target_session.add(notif)

            stats.add("notifications", created=1)
        except Exception as e:
            log(f"  Ошибка уведомления {n['id']}: {e}", verbose)
            stats.add("notifications", errors=1)

    if not dry_run:
        target_session.commit()
    log(f"  Уведомления: {stats.tables.get('notifications', {})}", verbose)


def main():
    parser = argparse.ArgumentParser(
        description="Миграция данных из SuppOrIT в Elements Platform"
    )
    parser.add_argument(
        "--source-db",
        default=os.getenv("SUPPORIT_DATABASE_URL", ""),
        help="URL базы данных SuppOrIT"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Только проверка, без записи данных"
    )
    parser.add_argument(
        "--skip-users",
        action="store_true",
        help="Пропустить миграцию пользователей"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        default=True,
        help="Подробный вывод"
    )

    args = parser.parse_args()

    if not args.source_db:
        print("ОШИБКА: Укажите URL базы данных SuppOrIT через --source-db или SUPPORIT_DATABASE_URL")
        print("\nПример:")
        print("  python scripts/migrate_from_supporit.py --source-db 'postgresql://user:pass@localhost:5432/supporit'")
        sys.exit(1)

    print("=" * 60)
    print("МИГРАЦИЯ ДАННЫХ: SuppOrIT -> Elements Platform")
    print("=" * 60)
    print(f"Источник: {args.source_db.split('@')[-1] if '@' in args.source_db else args.source_db}")
    print(f"Режим: {'DRY RUN (без записи)' if args.dry_run else 'ЗАПИСЬ ДАННЫХ'}")
    print("=" * 60)

    # Подключение к источнику
    try:
        source_engine = create_engine(args.source_db)
        SourceSession = sessionmaker(bind=source_engine)
        source_session = SourceSession()

        # Проверка подключения
        source_session.execute(text("SELECT 1"))
        log("Подключение к SuppOrIT: OK", args.verbose)
    except Exception as e:
        print(f"ОШИБКА подключения к SuppOrIT: {e}")
        sys.exit(1)

    # Подключение к цели
    try:
        target_session = SessionLocal()
        target_session.execute(text("SELECT 1"))
        log("Подключение к Elements: OK", args.verbose)
    except Exception as e:
        print(f"ОШИБКА подключения к Elements: {e}")
        sys.exit(1)

    stats = MigrationStats()

    try:
        # Порядок миграции важен из-за foreign keys

        # 1. Пользователи (базовая таблица)
        if not args.skip_users:
            migrate_users(source_session, target_session, stats, args.dry_run, args.verbose)

        # 2. Справочники
        migrate_dictionaries(source_session, target_session, stats, args.dry_run, args.verbose)

        # 3. Здания и комнаты
        migrate_buildings(source_session, target_session, stats, args.dry_run, args.verbose)
        migrate_rooms(source_session, target_session, stats, args.dry_run, args.verbose)

        # 4. Оборудование и расходники
        migrate_equipment(source_session, target_session, stats, args.dry_run, args.verbose)
        migrate_consumables(source_session, target_session, stats, args.dry_run, args.verbose)

        # 5. Лицензии
        migrate_software_licenses(source_session, target_session, stats, args.dry_run, args.verbose)
        migrate_license_assignments(source_session, target_session, stats, args.dry_run, args.verbose)

        # 6. Тикеты и история
        migrate_tickets(source_session, target_session, stats, args.dry_run, args.verbose)
        migrate_ticket_comments(source_session, target_session, stats, args.dry_run, args.verbose)
        migrate_ticket_history(source_session, target_session, stats, args.dry_run, args.verbose)

        # 7. История оборудования
        migrate_equipment_history(source_session, target_session, stats, args.dry_run, args.verbose)

        # 8. Выдача расходников
        migrate_consumable_issues(source_session, target_session, stats, args.dry_run, args.verbose)

        # 9. Заявки на оборудование
        migrate_equipment_requests(source_session, target_session, stats, args.dry_run, args.verbose)

        # 10. Уведомления
        migrate_notifications(source_session, target_session, stats, args.dry_run, args.verbose)

    except Exception as e:
        print(f"\nКРИТИЧЕСКАЯ ОШИБКА: {e}")
        target_session.rollback()
        raise
    finally:
        source_session.close()
        target_session.close()

    stats.print_summary()

    if args.dry_run:
        print("\n⚠️  Это был DRY RUN. Данные НЕ были записаны.")
        print("   Для реальной миграции уберите флаг --dry-run")


if __name__ == "__main__":
    main()
