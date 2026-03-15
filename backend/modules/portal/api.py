"""
API роуты для Portal модуля
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.auth import get_token_payload, require_superuser, oauth2_scheme


def require_portal_news_editor(token: str = Depends(oauth2_scheme)):
    """Доступ к управлению новостями: суперпользователь, администратор портала или секретарь."""
    payload = get_token_payload(token)
    if payload.get("is_superuser"):
        return payload
    portal_role = (payload.get("roles") or {}).get("portal")
    if portal_role in ("admin", "secretary"):
        return payload
    raise HTTPException(
        status_code=403,
        detail="Доступ к управлению новостями только у администратора портала или секретаря",
    )


from backend.core.config import settings
from backend.core.database import get_db
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User
from backend.modules.it.models import Equipment
from backend.modules.it.services.zabbix_service import zabbix_service
from backend.modules.portal.models import Announcement, CalendarEvent
from backend.modules.portal.services import PortalService
from backend.modules.tasks.dependencies import get_current_user

router = APIRouter(prefix=f"{settings.api_v1_prefix}/portal", tags=["portal"])


@router.get("/dashboard")
async def get_dashboard(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
    user: User = Depends(get_current_user),
):
    """
    Получает данные для стартовой страницы.
    Доступно всем авторизованным пользователям.
    """
    service = PortalService(db)
    data = service.get_dashboard_data(user)
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


@router.get("/dashboard/actions")
async def get_dashboard_actions(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
    user: User = Depends(get_current_user),
):
    """
    Элементы, требующие внимания текущего пользователя.
    Загружается отдельно от основного dashboard для параллельной загрузки.
    """
    user_modules: list[str] = payload.get("modules", [])
    is_superuser: bool = payload.get("is_superuser", False)
    if is_superuser:
        user_modules = list(set(user_modules) | {"documents", "it", "tasks"})
    service = PortalService(db)
    return service.get_action_items(user, user_modules)


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
    payload: dict = Depends(get_token_payload),
    user: User = Depends(get_current_user),
):
    """
    Получает статистику по компании.
    """
    service = PortalService(db)
    stats = service.get_company_stats(user)
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
    return _event_response(event)


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    is_all_day: bool | None = None
    color: str | None = None


def _event_response(event: CalendarEvent) -> dict:
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


@router.patch("/calendar/events/{event_id}")
async def update_calendar_event(
    event_id: UUID,
    body: CalendarEventUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Изменить событие календаря."""
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    data = body.model_dump(exclude_unset=True)
    if "start_at" in data and data["start_at"]:
        try:
            data["start_at"] = datetime.fromisoformat(data["start_at"].replace("Z", "+00:00"))
        except ValueError:
            del data["start_at"]
    if "end_at" in data and data["end_at"]:
        try:
            data["end_at"] = datetime.fromisoformat(data["end_at"].replace("Z", "+00:00"))
        except ValueError:
            del data["end_at"]
    for k, v in data.items():
        setattr(event, k, v)
    db.commit()
    db.refresh(event)
    return _event_response(event)


@router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Удалить событие календаря."""
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Событие не найдено")
    db.delete(event)
    db.commit()
    return {"ok": True}


# --- Важные объявления (только для администратора) ---

class AnnouncementCreate(BaseModel):
    title: str
    content: str | None = None
    image_color: str | None = "bg-blue-100"
    is_active: bool = True


class AnnouncementUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    image_color: str | None = None
    is_active: bool | None = None


def _announcement_response(a: Announcement) -> dict:
    return {
        "id": str(a.id),
        "title": a.title,
        "content": a.content,
        "image_color": a.image_color or "bg-blue-100",
        "is_active": a.is_active,
        "date": a.created_at.strftime("%d.%m.%Y") if a.created_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("/announcements")
async def list_announcements_admin(
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_portal_news_editor),
):
    """Список всех объявлений (для управления). Администратор портала или секретарь."""
    announcements = (
        db.query(Announcement)
        .order_by(Announcement.created_at.desc())
        .all()
    )
    return [_announcement_response(a) for a in announcements]


@router.post("/announcements")
async def create_announcement(
    body: AnnouncementCreate,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_portal_news_editor),
):
    """Создать важное объявление. Администратор портала или секретарь."""
    announcement = Announcement(
        title=body.title,
        content=body.content,
        image_color=body.image_color or "bg-blue-100",
        is_active=body.is_active,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return _announcement_response(announcement)


@router.patch("/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: UUID,
    body: AnnouncementUpdate,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_portal_news_editor),
):
    """Изменить объявление. Администратор портала или секретарь."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Объявление не найдено")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(announcement, k, v)
    db.commit()
    db.refresh(announcement)
    return _announcement_response(announcement)


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: UUID,
    db: Session = Depends(get_db),
    _payload: dict = Depends(require_portal_news_editor),
):
    """Удалить объявление. Администратор портала или секретарь."""
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Объявление не найдено")
    db.delete(announcement)
    db.commit()
    return {"ok": True}
