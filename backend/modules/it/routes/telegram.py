"""
Telegram API Routes
Маршруты для работы с Telegram интеграцией
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db
from backend.modules.it.services.telegram_service import telegram_service

router = APIRouter(prefix="/telegram", tags=["telegram"])


# --- Schemas ---


class TelegramStatusResponse(BaseModel):
    enabled: bool
    connected: bool
    bot_username: Optional[str] = None
    user_linked: bool
    telegram_username: Optional[str] = None
    notifications_enabled: bool


class LinkCodeResponse(BaseModel):
    code: str
    expires_at: datetime
    bot_username: str


class NotificationSettingsUpdate(BaseModel):
    telegram_notifications: bool


class BotInfoResponse(BaseModel):
    connected: bool
    bot_id: Optional[int] = None
    bot_username: Optional[str] = None
    bot_first_name: Optional[str] = None


# --- Routes ---


@router.get("/bot-info", response_model=BotInfoResponse)
async def get_bot_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить информацию о боте"""
    bot_info = await telegram_service.get_bot_info(db)

    if bot_info:
        return BotInfoResponse(
            connected=True,
            bot_id=bot_info.get("id"),
            bot_username=bot_info.get("username"),
            bot_first_name=bot_info.get("first_name"),
        )

    return BotInfoResponse(connected=False)


@router.get("/status", response_model=TelegramStatusResponse)
async def get_telegram_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить статус Telegram интеграции для текущего пользователя"""
    # Проверяем включена ли интеграция
    enabled_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "telegram_bot_enabled")
        .first()
    )
    enabled = enabled_setting and enabled_setting.setting_value.lower() == "true"

    # Проверяем подключение
    connected = await telegram_service.check_connection(db) if enabled else False

    # Получаем username бота
    bot_username_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "telegram_bot_username")
        .first()
    )
    bot_username = bot_username_setting.setting_value if bot_username_setting else None

    # Проверяем привязан ли пользователь
    user_linked = current_user.telegram_id is not None
    telegram_username = current_user.telegram_username if user_linked else None
    notifications_enabled = (
        current_user.telegram_notifications if user_linked else False
    )

    return TelegramStatusResponse(
        enabled=enabled,
        connected=connected,
        bot_username=bot_username,
        user_linked=user_linked,
        telegram_username=telegram_username,
        notifications_enabled=notifications_enabled,
    )


@router.post("/generate-link-code", response_model=LinkCodeResponse)
async def generate_link_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Сгенерировать код для привязки Telegram аккаунта"""
    # Проверяем что интеграция включена
    enabled_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "telegram_bot_enabled")
        .first()
    )
    if not enabled_setting or enabled_setting.setting_value.lower() != "true":
        raise HTTPException(status_code=400, detail="Telegram интеграция отключена")

    # Проверяем подключение
    if not await telegram_service.check_connection(db):
        raise HTTPException(status_code=503, detail="Telegram бот недоступен")

    # Генерируем код
    code = telegram_service.generate_link_code()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Сохраняем код в пользователе
    current_user.telegram_link_code = code
    current_user.telegram_link_code_expires = expires_at
    db.commit()

    # Получаем username бота
    bot_username_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "telegram_bot_username")
        .first()
    )
    bot_username = bot_username_setting.setting_value if bot_username_setting else ""

    return LinkCodeResponse(
        code=code,
        expires_at=expires_at,
        bot_username=bot_username,
    )


@router.post("/unlink")
async def unlink_telegram(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отвязать Telegram аккаунт"""
    if not current_user.telegram_id:
        raise HTTPException(status_code=400, detail="Telegram не привязан")

    current_user.telegram_id = None
    current_user.telegram_username = None
    current_user.telegram_notifications = False
    current_user.telegram_link_code = None
    current_user.telegram_link_code_expires = None
    db.commit()

    return {"success": True, "message": "Telegram аккаунт отвязан"}


@router.put("/settings")
async def update_notification_settings(
    settings: NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновить настройки уведомлений"""
    if not current_user.telegram_id:
        raise HTTPException(status_code=400, detail="Telegram не привязан")

    current_user.telegram_notifications = settings.telegram_notifications
    db.commit()

    return {
        "success": True,
        "telegram_notifications": current_user.telegram_notifications,
    }


@router.post("/webhook")
async def telegram_webhook(
    update: dict,
    db: Session = Depends(get_db),
):
    """
    Webhook для обработки сообщений от Telegram бота.
    Этот endpoint должен быть зарегистрирован в Telegram Bot API.
    """
    # Обработка входящих сообщений
    message = update.get("message")
    if not message:
        return {"ok": True}

    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")
    from_user = message.get("from", {})
    telegram_username = from_user.get("username")

    # Обработка команды /start с кодом привязки
    if text.startswith("/start"):
        parts = text.split()
        if len(parts) > 1:
            link_code = parts[1]

            # Ищем пользователя с таким кодом
            user = (
                db.query(User)
                .filter(
                    User.telegram_link_code == link_code,
                    User.telegram_link_code_expires > datetime.utcnow(),
                )
                .first()
            )

            if user:
                # Привязываем аккаунт
                user.telegram_id = chat_id
                user.telegram_username = telegram_username
                user.telegram_notifications = True
                user.telegram_link_code = None
                user.telegram_link_code_expires = None
                db.commit()

                await telegram_service.send_message(
                    db,
                    chat_id,
                    f"Аккаунт успешно привязан к пользователю {user.full_name}!\n\n"
                    "Теперь вы будете получать уведомления о заявках.",
                )
            else:
                await telegram_service.send_message(
                    db,
                    chat_id,
                    "Код привязки недействителен или истёк.\n"
                    "Получите новый код в настройках системы.",
                )
        else:
            await telegram_service.send_message(
                db,
                chat_id,
                "Добро пожаловать!\n\n"
                "Для привязки аккаунта получите код в настройках системы IT и отправьте его сюда.",
            )

    # Обработка callback-кнопок
    callback_query = update.get("callback_query")
    if callback_query:
        callback_data = callback_query.get("data", "")

        if callback_data.startswith("ticket_view_"):
            # Просто подтверждаем callback
            pass

    return {"ok": True}


@router.post("/test-notification")
async def send_test_notification(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отправить тестовое уведомление"""
    if not current_user.telegram_id:
        raise HTTPException(status_code=400, detail="Telegram не привязан")

    success = await telegram_service.send_notification(
        db,
        current_user.id,
        "Тестовое уведомление",
        "Это тестовое уведомление для проверки работы Telegram интеграции.",
    )

    if success:
        return {"success": True, "message": "Тестовое уведомление отправлено"}
    else:
        raise HTTPException(status_code=500, detail="Не удалось отправить уведомление")
