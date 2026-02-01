"""
RocketChat API Routes
Маршруты для работы с RocketChat интеграцией (Outgoing Webhook, уведомления).
"""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.modules.hr.dependencies import require_superuser
from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db
from backend.modules.it.services.rocketchat_service import rocketchat_service

router = APIRouter(prefix="/rocketchat", tags=["rocketchat"])


# --- Schemas ---


class RocketChatStatusResponse(BaseModel):
    enabled: bool
    connected: bool


# --- Routes ---


@router.post("/webhook")
async def rocketchat_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Принимает Outgoing Webhook от RocketChat.
    Не требует авторизации Elements — валидирует token из payload.
    Возвращает {"text": "..."} для отображения в канале.
    """
    payload = await request.json()
    result = await rocketchat_service.process_webhook_message(db, payload)
    if result:
        return result
    return {"text": None}


@router.get("/status", response_model=RocketChatStatusResponse)
async def get_rocketchat_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить статус подключения к RocketChat."""
    enabled = rocketchat_service._is_enabled(db)
    connected = await rocketchat_service.check_connection(db) if enabled else False

    return RocketChatStatusResponse(
        enabled=enabled,
        connected=connected,
    )


@router.post("/test", dependencies=[Depends(require_superuser)])
async def test_rocketchat_connection(
    db: Session = Depends(get_db),
) -> dict:
    """Тестировать подключение к RocketChat (requires superuser)."""
    result = await rocketchat_service.check_connection(db)
    if result:
        return {
            "status": "success",
            "message": "RocketChat подключён успешно",
        }
    return {
        "status": "error",
        "message": "Не удалось подключиться к RocketChat. Проверьте URL, User ID и Auth Token.",
    }
