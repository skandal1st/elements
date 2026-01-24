"""
API роуты для Portal модуля
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.core.auth import get_token_payload
from backend.core.config import settings
from backend.core.database import get_db
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
    return service.get_dashboard_data()


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
    return service.get_company_stats()
