"""
API роуты для IT модуля.
Префикс: /api/v1/it. Подроуты: /equipment, /tickets, /buildings, /users.
"""

from fastapi import APIRouter

from backend.core.config import settings

from .routes import (
    buildings,
    consumables,
    dictionaries,
    email,
    equipment,
    equipment_catalog,
    equipment_history,
    equipment_requests,
    licenses,
    notifications,
    reports,
    rooms,
    telegram,
    ticket_comments,
    tickets,
    users,
    zabbix,
)
from .routes import (
    settings as settings_routes,
)

router = APIRouter(prefix=f"{settings.api_v1_prefix}/it", tags=["it"])

router.include_router(equipment.router)
router.include_router(tickets.router)
router.include_router(ticket_comments.router)
router.include_router(equipment_history.router)
router.include_router(consumables.router)
router.include_router(equipment_requests.router)
router.include_router(reports.router)
router.include_router(licenses.router)
router.include_router(dictionaries.router)
router.include_router(notifications.router)
router.include_router(equipment_catalog.router)
router.include_router(rooms.router)
router.include_router(buildings.router)
router.include_router(users.router)
router.include_router(settings_routes.router)
router.include_router(zabbix.router)
router.include_router(telegram.router)
router.include_router(email.router)


@router.get("/")
async def it_module_info():
    """Информация о IT модуле"""
    return {
        "module": "it",
        "name": "IT Module",
        "version": "1.0.0",
        "status": "active",
    }
