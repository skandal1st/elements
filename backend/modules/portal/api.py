"""
API роуты для Portal модуля
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.auth import get_token_payload
from backend.core.config import settings
from backend.core.database import get_db
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.it.models import Equipment
from backend.modules.it.services.zabbix_service import zabbix_service
from backend.modules.portal.services import PortalService

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
