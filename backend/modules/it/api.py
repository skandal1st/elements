<<<<<<< HEAD
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
    rocketchat,
    rooms,
    telegram,
    ticket_comments,
    tickets,
    users,
    videoconference,
    zabbix,
)
from .routes import (
    settings as settings_routes,
)
from backend.modules.knowledge_core import api as knowledge_api

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
router.include_router(rocketchat.router)
router.include_router(email.router)
router.include_router(videoconference.router)
router.include_router(knowledge_api.router)


@router.get("/")
async def it_module_info():
    """Информация о IT модуле"""
    return {
        "module": "it",
        "name": "IT Module",
        "version": "1.0.0",
        "status": "active",
    }
=======
"""
API роуты для IT модуля.
Префикс: /api/v1/it. Подроуты: /equipment, /tickets, /buildings, /users.
"""

import logging
from fastapi import APIRouter

from backend.core.config import settings
from backend.core.edition import is_integration_allowed, is_module_allowed, Edition, CURRENT_EDITION

# Core routes (always available)
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
)
from .routes import (
    settings as settings_routes,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix=f"{settings.api_v1_prefix}/it", tags=["it"])

# Core routes (always available)
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
router.include_router(telegram.router)
router.include_router(email.router)

# Enterprise integrations (conditional)
if is_integration_allowed("zabbix"):
    from .routes import zabbix
    router.include_router(zabbix.router)
    logger.info("✓ Zabbix integration enabled (Enterprise)")
else:
    logger.info("✗ Zabbix integration not available (requires Enterprise)")

if is_integration_allowed("rocketchat"):
    from .routes import rocketchat
    router.include_router(rocketchat.router)
    logger.info("✓ RocketChat integration enabled (Enterprise)")
else:
    logger.info("✗ RocketChat integration not available (requires Enterprise)")

# Knowledge Core (Enterprise only)
if CURRENT_EDITION == Edition.ENTERPRISE:
    try:
        from backend.modules.knowledge_core import api as knowledge_api
        router.include_router(knowledge_api.router, prefix="/knowledge")
        logger.info("✓ Knowledge Core API enabled (Enterprise)")
    except ImportError as e:
        logger.warning(f"Knowledge Core module not found: {e}")
else:
    logger.info("✗ Knowledge Core not available (requires Enterprise)")


@router.get("/")
async def it_module_info():
    """Информация о IT модуле"""
    return {
        "module": "it",
        "name": "IT Module",
        "version": "1.0.0",
        "status": "active",
    }
>>>>>>> 1c0b322 (поправлены выпадающие меню)
