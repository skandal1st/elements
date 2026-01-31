"""
API роуты для HR модуля.
Префикс: /api/v1/hr. Подроуты: /employees, /departments, /positions, …
"""
from fastapi import APIRouter

from backend.core.config import settings

from .routes import (
    audit,
    birthdays,
    departments,
    employees,
    equipment,
    hr_requests,
    integrations,
    org,
    phonebook,
    positions,
    users,
)

router = APIRouter(prefix=f"{settings.api_v1_prefix}/hr", tags=["hr"])

router.include_router(employees.router)
router.include_router(departments.router)
router.include_router(positions.router)
router.include_router(hr_requests.router)
router.include_router(phonebook.router)
router.include_router(birthdays.router)
router.include_router(org.router)
router.include_router(equipment.router)
router.include_router(audit.router)
router.include_router(users.router)
router.include_router(integrations.router)


@router.get("/")
async def hr_module_info():
    """Информация о HR модуле"""
    return {
        "module": "hr",
        "name": "HR Module",
        "version": "1.0.0",
        "status": "active",
    }
