"""Сервис для логирования истории изменений тикетов."""

from typing import Any, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from backend.modules.it.models import TicketHistory

# Поля, изменения которых отслеживаются
TRACKED_FIELDS = [
    "status",
    "priority",
    "category",
    "assignee_id",
    "creator_id",
    "title",
    "description",
    "equipment_id",
    "room_id",
    "resolved_at",
    "closed_at",
]

# Человекочитаемые названия полей
FIELD_LABELS = {
    "status": "Статус",
    "priority": "Приоритет",
    "category": "Категория",
    "assignee_id": "Исполнитель",
    "creator_id": "Создатель",
    "title": "Заголовок",
    "description": "Описание",
    "equipment_id": "Оборудование",
    "room_id": "Кабинет",
    "resolved_at": "Дата решения",
    "closed_at": "Дата закрытия",
}


def _value_to_str(value: Any) -> Optional[str]:
    """Преобразует значение в строку для хранения в истории."""
    if value is None:
        return None
    if isinstance(value, UUID):
        return str(value)
    return str(value)


def log_ticket_change(
    db: Session,
    ticket_id: UUID,
    changed_by_id: UUID,
    field: str,
    old_value: Any,
    new_value: Any,
) -> TicketHistory:
    """
    Логирует изменение одного поля тикета.

    Args:
        db: Сессия базы данных
        ticket_id: ID тикета
        changed_by_id: ID пользователя, внёсшего изменение
        field: Название изменённого поля
        old_value: Старое значение
        new_value: Новое значение

    Returns:
        Созданная запись истории
    """
    history = TicketHistory(
        ticket_id=ticket_id,
        changed_by_id=changed_by_id,
        field=field,
        old_value=_value_to_str(old_value),
        new_value=_value_to_str(new_value),
    )
    db.add(history)
    return history


def log_ticket_changes(
    db: Session,
    ticket_id: UUID,
    changed_by_id: UUID,
    old_data: dict,
    new_data: dict,
    tracked_fields: Optional[List[str]] = None,
) -> List[TicketHistory]:
    """
    Логирует множественные изменения тикета.

    Сравнивает old_data и new_data, находит различия в tracked_fields
    и создаёт записи истории для каждого изменённого поля.

    Args:
        db: Сессия базы данных
        ticket_id: ID тикета
        changed_by_id: ID пользователя, внёсшего изменения
        old_data: Словарь со старыми значениями полей
        new_data: Словарь с новыми значениями полей (только изменённые поля)
        tracked_fields: Список полей для отслеживания (по умолчанию TRACKED_FIELDS)

    Returns:
        Список созданных записей истории
    """
    if tracked_fields is None:
        tracked_fields = TRACKED_FIELDS

    history_records = []

    for field in tracked_fields:
        if field not in new_data:
            continue

        old_value = old_data.get(field)
        new_value = new_data.get(field)

        # Сравниваем значения (с учётом UUID)
        old_str = _value_to_str(old_value)
        new_str = _value_to_str(new_value)

        if old_str != new_str:
            history = log_ticket_change(
                db=db,
                ticket_id=ticket_id,
                changed_by_id=changed_by_id,
                field=field,
                old_value=old_value,
                new_value=new_value,
            )
            history_records.append(history)

    return history_records
