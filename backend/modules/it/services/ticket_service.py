"""Сервис для работы с тикетами IT-модуля."""

from uuid import UUID

from sqlalchemy.orm import Session

from backend.modules.it.models import Ticket


def create_ticket_from_hr(
    db: Session,
    title: str,
    description: str,
    category: str = "hr",
    priority: str = "medium",
    creator_id: UUID | None = None,
) -> Ticket:
    """Создать тикет из HR-события (онбординг/оффбординг).

    Args:
        db: SQLAlchemy сессия
        title: Заголовок тикета
        description: Описание тикета
        category: Категория тикета (по умолчанию "hr")
        priority: Приоритет тикета (по умолчанию "medium")
        creator_id: UUID создателя (опционально)

    Returns:
        Созданный тикет
    """
    ticket = Ticket(
        title=title,
        description=description,
        category=category,
        priority=priority,
        status="new",
        source="hr",
        creator_id=creator_id,
    )
    db.add(ticket)
    db.flush()
    return ticket
