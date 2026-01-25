"""
Сервис для логирования истории изменений задач.
"""
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from backend.modules.tasks.models import TaskHistory


# Поля, которые отслеживаются по умолчанию
TRACKED_FIELDS = [
    "title",
    "description",
    "status",
    "priority",
    "assignee_id",
    "due_date",
    "start_date",
    "parent_id",
    "labels",
    "estimated_hours",
    "actual_hours",
    "linked_ticket_id",
    "linked_employee_id",
]


def _value_to_str(value: Any) -> Optional[str]:
    """Преобразует значение в строку для хранения в истории."""
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        import json
        return json.dumps(value, default=str)
    return str(value)


def log_task_changes(
    db: Session,
    task_id: UUID,
    changed_by_id: UUID,
    old_data: Dict[str, Any],
    new_data: Dict[str, Any],
    tracked_fields: Optional[List[str]] = None,
) -> List[TaskHistory]:
    """
    Логирует изменения задачи.

    Args:
        db: сессия базы данных
        task_id: ID задачи
        changed_by_id: ID пользователя, внесшего изменения
        old_data: словарь со старыми значениями полей
        new_data: словарь с новыми значениями полей
        tracked_fields: список полей для отслеживания (по умолчанию TRACKED_FIELDS)

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

        # Приводим к строкам для сравнения
        old_str = _value_to_str(old_value)
        new_str = _value_to_str(new_value)

        if old_str != new_str:
            record = TaskHistory(
                task_id=task_id,
                changed_by_id=changed_by_id,
                field=field,
                old_value=old_str,
                new_value=new_str,
            )
            db.add(record)
            history_records.append(record)

    return history_records


def log_task_creation(
    db: Session,
    task_id: UUID,
    created_by_id: UUID,
) -> TaskHistory:
    """Логирует создание задачи."""
    record = TaskHistory(
        task_id=task_id,
        changed_by_id=created_by_id,
        field="created",
        old_value=None,
        new_value="Задача создана",
    )
    db.add(record)
    return record


def log_task_status_change(
    db: Session,
    task_id: UUID,
    changed_by_id: UUID,
    old_status: str,
    new_status: str,
) -> TaskHistory:
    """Логирует изменение статуса задачи."""
    record = TaskHistory(
        task_id=task_id,
        changed_by_id=changed_by_id,
        field="status",
        old_value=old_status,
        new_value=new_status,
    )
    db.add(record)
    return record
