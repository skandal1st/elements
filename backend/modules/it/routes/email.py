"""
Email API Routes
Маршруты для работы с Email интеграцией
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db
from backend.modules.it.services.email_service import email_service
from backend.modules.it.services.email_receiver import email_receiver

router = APIRouter(prefix="/email", tags=["email"])


# --- Schemas ---


class EmailStatusResponse(BaseModel):
    enabled: bool
    smtp_configured: bool
    smtp_connected: bool
    imap_configured: bool
    from_email: Optional[str] = None
    error: Optional[str] = None


class EmailSettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    email_from: Optional[str] = None
    email_from_name: Optional[str] = None
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_user: Optional[str] = None
    imap_password: Optional[str] = None
    imap_use_ssl: Optional[bool] = None


class TestEmailRequest(BaseModel):
    to_email: EmailStr


# --- Routes ---


@router.get("/status", response_model=EmailStatusResponse)
async def get_email_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить статус Email интеграции"""
    # Проверяем права (только IT-специалисты и админы)
    roles = current_user.roles or {}
    it_role = roles.get("it", "employee")
    if it_role not in ["admin", "it_specialist"] and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    # Получаем настройки
    enabled_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "email_enabled")
        .first()
    )
    enabled = enabled_setting and enabled_setting.setting_value.lower() == "true"

    smtp_host = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "smtp_host")
        .first()
    )
    smtp_configured = smtp_host is not None and bool(smtp_host.setting_value)

    imap_host = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "imap_host")
        .first()
    )
    imap_configured = imap_host is not None and bool(imap_host.setting_value)

    from_email_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "email_from")
        .first()
    )
    from_email = from_email_setting.setting_value if from_email_setting else None

    # Проверяем подключение
    smtp_connected = False
    error = None
    if enabled and smtp_configured:
        smtp_connected, error = await email_service.check_connection(db)

    return EmailStatusResponse(
        enabled=enabled,
        smtp_configured=smtp_configured,
        smtp_connected=smtp_connected,
        imap_configured=imap_configured,
        from_email=from_email,
        error=error,
    )


@router.post("/test")
async def send_test_email(
    request: TestEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отправить тестовое письмо"""
    # Проверяем права
    roles = current_user.roles or {}
    it_role = roles.get("it", "employee")
    if it_role not in ["admin", "it_specialist"] and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    # Проверяем включена ли интеграция
    enabled_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "email_enabled")
        .first()
    )
    if not enabled_setting or enabled_setting.setting_value.lower() != "true":
        raise HTTPException(status_code=400, detail="Email интеграция отключена")

    # Отправляем тестовое письмо
    html = """
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Тестовое письмо</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">

  <div style="background-color: #10b981; color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Тестовое письмо</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="margin: 0 0 20px 0; font-size: 14px;">
      Это тестовое письмо для проверки работы Email интеграции в системе Elements IT.
    </p>
    <p style="margin: 0; font-size: 14px; color: #10b981;">
      Если вы видите это письмо, значит настройка SMTP выполнена корректно.
    </p>
  </div>

</body>
</html>
    """

    success = await email_service.send_email(
        db,
        request.to_email,
        "Тестовое письмо - Elements IT",
        html,
    )

    if success:
        return {
            "success": True,
            "message": f"Тестовое письмо отправлено на {request.to_email}",
        }
    else:
        raise HTTPException(status_code=500, detail="Не удалось отправить письмо")


@router.get("/settings")
async def get_email_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить текущие настройки email"""
    # Проверяем права
    roles = current_user.roles or {}
    it_role = roles.get("it", "employee")
    if it_role not in ["admin", "it_specialist"] and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    settings_keys = [
        "email_enabled",
        "smtp_host",
        "smtp_port",
        "smtp_user",
        "smtp_use_tls",
        "email_from",
        "email_from_name",
        "imap_host",
        "imap_port",
        "imap_user",
        "imap_use_ssl",
    ]

    settings = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key.in_(settings_keys))
        .all()
    )

    result = {}
    for s in settings:
        # Не возвращаем пароли
        if "password" not in s.setting_key:
            if s.setting_key in ["smtp_port", "imap_port"]:
                result[s.setting_key] = (
                    int(s.setting_value) if s.setting_value else None
                )
            elif s.setting_key in ["email_enabled", "smtp_use_tls", "imap_use_ssl"]:
                result[s.setting_key] = (
                    s.setting_value.lower() == "true" if s.setting_value else False
                )
            else:
                result[s.setting_key] = s.setting_value

    return result


@router.put("/settings")
async def update_email_settings(
    settings: EmailSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновить настройки email"""
    # Проверяем права - только админы
    roles = current_user.roles or {}
    it_role = roles.get("it", "employee")
    if it_role != "admin" and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    settings_dict = settings.model_dump(exclude_none=True)

    for key, value in settings_dict.items():
        # Преобразуем в строку
        str_value = str(value).lower() if isinstance(value, bool) else str(value)

        existing = (
            db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
        )

        if existing:
            existing.setting_value = str_value
        else:
            new_setting = SystemSettings(
                setting_key=key,
                setting_value=str_value,
            )
            db.add(new_setting)

    db.commit()

    return {"success": True, "message": "Настройки сохранены"}


@router.post("/enable")
async def enable_email_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Включить Email интеграцию"""
    roles = current_user.roles or {}
    it_role = roles.get("it", "employee")
    if it_role != "admin" and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    existing = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "email_enabled")
        .first()
    )

    if existing:
        existing.setting_value = "true"
    else:
        new_setting = SystemSettings(
            setting_key="email_enabled",
            setting_value="true",
        )
        db.add(new_setting)

    db.commit()
    return {"success": True, "enabled": True}


@router.post("/disable")
async def disable_email_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Отключить Email интеграцию"""
    roles = current_user.roles or {}
    it_role = roles.get("it", "employee")
    if it_role != "admin" and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    existing = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "email_enabled")
        .first()
    )

    if existing:
        existing.setting_value = "false"
    else:
        new_setting = SystemSettings(
            setting_key="email_enabled",
            setting_value="false",
        )
        db.add(new_setting)

    db.commit()
    return {"success": True, "enabled": False}


@router.post("/check-inbox")
def check_inbox_emails(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Проверить входящие письма и создать тикеты.

    Это ручной триггер проверки почтового ящика.
    В production рекомендуется настроить cron-задачу.
    """
    # Проверяем права - только IT-специалисты и админы
    roles = current_user.roles or {}
    it_role = roles.get("it", "employee")
    if it_role not in ["admin", "it_specialist"] and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    result = email_receiver.check_new_emails(db)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Ошибка проверки почты"))

    return result


@router.get("/imap-status")
async def get_imap_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить статус IMAP конфигурации"""
    roles = current_user.roles or {}
    it_role = roles.get("it", "employee")
    if it_role not in ["admin", "it_specialist"] and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    imap_host = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "imap_host")
        .first()
    )
    imap_user = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "imap_user")
        .first()
    )
    imap_password = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "imap_password")
        .first()
    )

    configured = all([
        imap_host and imap_host.setting_value,
        imap_user and imap_user.setting_value,
        imap_password and imap_password.setting_value,
    ])

    return {
        "configured": configured,
        "host": imap_host.setting_value if imap_host else None,
        "user": imap_user.setting_value if imap_user else None,
    }
