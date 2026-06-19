"""Платформенные роуты: /api/v1/platform/{license,updates}."""
from fastapi import APIRouter

from backend.core.config import settings

from .routes import license as license_routes
from .routes import updates as updates_routes

router = APIRouter(prefix=f"{settings.api_v1_prefix}/platform", tags=["platform"])

router.include_router(license_routes.router)
router.include_router(updates_routes.router)
