"""
API роуты для Portal модуля
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.auth import get_token_payload
from backend.core.config import settings
from backend.core.database import get_db
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User
from backend.modules.it.models import Equipment
from backend.modules.it.services.zabbix_service import zabbix_service
from backend.modules.portal.models import CalendarEvent
from backend.modules.portal.services import PortalService
from backend.modules.tasks.dependencies import get_current_user

router = APIRouter(prefix=f"{settings.api_v1_prefix}/portal", tags=["portal"])


@router.get("/dashboard")
async def get_dashboard(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """
    Получает данные для стартовой страницы.
    Доступно всем авторизованным пользователям.
    """
    service = PortalService(db)
    data = service.get_dashboard_data()
    rows = (
        db.query(Equipment.zabbix_host_id)
        .filter(Equipment.zabbix_host_id.isnot(None))
        .distinct()
        .all()
    )
    host_ids = [r[0] for r in rows if r[0]]
    try:
        data["stats"]["devices_online"] = await zabbix_service.get_devices_online_count(
            db, host_ids
        )
    except Exception:
        data["stats"]["devices_online"] = None
    return data


@router.get("/birthdays")
async def get_birthdays(
    days_ahead: int = 30,
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """
    Получает ближайшие дни рождения.
    """
    service = PortalService(db)
    return service.get_upcoming_birthdays(days_ahead)


@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """
    Получает статистику по компании.
    """
    service = PortalService(db)
    stats = service.get_company_stats()
    rows = (
        db.query(Equipment.zabbix_host_id)
        .filter(Equipment.zabbix_host_id.isnot(None))
        .distinct()
        .all()
    )
    host_ids = [r[0] for r in rows if r[0]]
    try:
        stats["devices_online"] = await zabbix_service.get_devices_online_count(
            db, host_ids
        )
    except Exception:
        stats["devices_online"] = None
    return stats


@router.get("/last-email-check")
async def get_last_email_check(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
):
    """
    Время последней проверки почты (cron или ручной «Проверить почту»).
    Доступно всем авторизованным пользователям.
    """
    row = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "email_last_check_at")
        .first()
    )
    return {"last_check_at": row.setting_value if row and row.setting_value else None}


# --- Календарь (события + задачи за период) ---

@router.get("/calendar")
async def get_calendar(
    from_d: str = Query(..., description="Начало периода (ISO date или datetime)"),
    to_d: str = Query(..., description="Конец периода (ISO date или datetime)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    События и задачи в заданном диапазоне для отображения в календаре.
    """
    try:
        if "T" in from_d:
            from_dt = datetime.fromisoformat(from_d.replace("Z", "+00:00"))
        else:
            from_dt = datetime.fromisoformat(from_d + "T00:00:00").replace(tzinfo=timezone.utc)
        if "T" in to_d:
            to_dt = datetime.fromisoformat(to_d.replace("Z", "+00:00"))
        else:
            to_dt = datetime.fromisoformat(to_d + "T23:59:59.999999").replace(tzinfo=timezone.utc)
        if from_dt.tzinfo is None:
            from_dt = from_dt.replace(tzinfo=timezone.utc)
        if to_dt.tzinfo is None:
            to_dt = to_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        from_dt = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        to_dt = from_dt

    service = PortalService(db)
    events = service.get_calendar_events(from_dt, to_dt)
    tasks = service.get_calendar_tasks(user, from_dt, to_dt)
    return {"events": events, "tasks": tasks}


@router.get("/calendar/today-tasks")
async def get_today_tasks(
    date_str: str = Query(..., description="Дата в формате YYYY-MM-DD"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Задачи на указанный день (для блока под календарём)."""
    try:
        day = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        day = datetime.utcnow().date()
    service = PortalService(db)
    return service.get_tasks_for_day(user, day)


class CalendarEventCreate(BaseModel):
    title: str
    description: str | None = None
    start_at: str
    end_at: str
    is_all_day: bool = False
    color: str | None = None


@router.post("/calendar/events")
async def create_calendar_event(
    body: CalendarEventCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Создать событие календаря (видимое всем)."""
    try:
        start_at = datetime.fromisoformat(body.start_at.replace("Z", "+00:00"))
        end_at = datetime.fromisoformat(body.end_at.replace("Z", "+00:00"))
    except ValueError:
        start_at = datetime.utcnow()
        end_at = datetime.utcnow()

    event = CalendarEvent(
        title=body.title,
        description=body.description,
        start_at=start_at,
        end_at=end_at,
        is_all_day=body.is_all_day,
        color=body.color,
        created_by_id=user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {
        "id": str(event.id),
        "title": event.title,
        "description": event.description,
        "start_at": event.start_at.isoformat() if event.start_at else None,
        "end_at": event.end_at.isoformat() if event.end_at else None,
        "is_all_day": event.is_all_day,
        "color": event.color or "#3B82F6",
        "type": "event",
    }
