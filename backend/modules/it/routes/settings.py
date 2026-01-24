"""Роуты /it/settings — системные настройки IT модуля."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.it.dependencies import get_db, require_it_roles
from backend.modules.it.schemas.settings import (
    AllSettings,
    EmailSettings,
    GeneralSettings,
    ImapSettings,
    LdapSettings,
    SettingCreate,
    SettingOut,
    SettingsBulkUpdate,
    SettingUpdate,
    TelegramSettings,
    ZabbixSettings,
)

router = APIRouter(prefix="/settings", tags=["settings"])

# Маппинг типов настроек на группы
SETTING_TYPE_MAP = {
    "general": [
        "company_name",
        "company_logo_url",
        "system_email",
        "default_ticket_priority",
        "auto_assign_tickets",
        "ticket_notifications_enabled",
    ],
    "email": [
        "smtp_host",
        "smtp_port",
        "smtp_user",
        "smtp_password",
        "smtp_from_email",
        "smtp_from_name",
        "smtp_use_tls",
    ],
    "imap": [
        "imap_host",
        "imap_port",
        "imap_user",
        "imap_password",
        "imap_use_ssl",
        "imap_folder",
        "email_check_interval",
    ],
    "telegram": ["telegram_bot_token", "telegram_bot_enabled", "telegram_webhook_url"],
    "zabbix": ["zabbix_url", "zabbix_user", "zabbix_password", "zabbix_enabled"],
    "ldap": [
        "ldap_server",
        "ldap_port",
        "ldap_use_ssl",
        "ldap_base_dn",
        "ldap_bind_dn",
        "ldap_bind_password",
        "ldap_user_filter",
        "ldap_enabled",
    ],
}

# Настройки, которые должны быть скрыты при выводе (пароли и т.д.)
SENSITIVE_KEYS = [
    "smtp_password",
    "imap_password",
    "telegram_bot_token",
    "zabbix_password",
    "ldap_bind_password",
]


def _mask_sensitive(value: Optional[str], key: str) -> Optional[str]:
    """Маскирует чувствительные данные для вывода."""
    if key in SENSITIVE_KEYS and value:
        return "********"
    return value


def _get_setting_type(key: str) -> str:
    """Определяет тип настройки по ключу."""
    for setting_type, keys in SETTING_TYPE_MAP.items():
        if key in keys:
            return setting_type
    return "general"


@router.get(
    "/",
    response_model=List[SettingOut],
    dependencies=[Depends(require_it_roles(["admin"]))],
)
def list_settings(
    setting_type: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[SettingOut]:
    """Получить список всех настроек."""
    q = db.query(SystemSettings)
    if setting_type:
        q = q.filter(SystemSettings.setting_type == setting_type)
    settings = q.order_by(SystemSettings.setting_key).all()

    # Маскируем чувствительные данные
    result = []
    for s in settings:
        s_dict = {
            "id": s.id,
            "setting_key": s.setting_key,
            "setting_value": _mask_sensitive(s.setting_value, s.setting_key),
            "setting_type": s.setting_type,
            "description": s.description,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
        }
        result.append(SettingOut(**s_dict))
    return result


@router.get(
    "/all",
    response_model=AllSettings,
    dependencies=[Depends(require_it_roles(["admin"]))],
)
def get_all_settings(db: Session = Depends(get_db)) -> AllSettings:
    """Получить все настройки сгруппированные по типам."""
    settings = db.query(SystemSettings).all()
    settings_dict = {s.setting_key: s.setting_value for s in settings}

    def get_val(key: str, default=None):
        val = settings_dict.get(key)
        if val is None:
            return default
        # Преобразуем строковые bool
        if val.lower() in ("true", "false"):
            return val.lower() == "true"
        # Преобразуем числа
        try:
            return int(val)
        except (ValueError, TypeError):
            pass
        return val

    return AllSettings(
        general=GeneralSettings(
            company_name=get_val("company_name"),
            company_logo_url=get_val("company_logo_url"),
            system_email=get_val("system_email"),
            default_ticket_priority=get_val("default_ticket_priority", "medium"),
            auto_assign_tickets=get_val("auto_assign_tickets", False),
            ticket_notifications_enabled=get_val("ticket_notifications_enabled", True),
        ),
        email=EmailSettings(
            smtp_host=get_val("smtp_host"),
            smtp_port=get_val("smtp_port", 587),
            smtp_user=get_val("smtp_user"),
            smtp_password=_mask_sensitive(get_val("smtp_password"), "smtp_password"),
            smtp_from_email=get_val("smtp_from_email"),
            smtp_from_name=get_val("smtp_from_name"),
            smtp_use_tls=get_val("smtp_use_tls", True),
        ),
        imap=ImapSettings(
            imap_host=get_val("imap_host"),
            imap_port=get_val("imap_port", 993),
            imap_user=get_val("imap_user"),
            imap_password=_mask_sensitive(get_val("imap_password"), "imap_password"),
            imap_use_ssl=get_val("imap_use_ssl", True),
            imap_folder=get_val("imap_folder", "INBOX"),
            email_check_interval=get_val("email_check_interval", 5),
        ),
        telegram=TelegramSettings(
            telegram_bot_token=_mask_sensitive(
                get_val("telegram_bot_token"), "telegram_bot_token"
            ),
            telegram_bot_enabled=get_val("telegram_bot_enabled", False),
            telegram_webhook_url=get_val("telegram_webhook_url"),
        ),
        zabbix=ZabbixSettings(
            zabbix_url=get_val("zabbix_url"),
            zabbix_user=get_val("zabbix_user"),
            zabbix_password=_mask_sensitive(
                get_val("zabbix_password"), "zabbix_password"
            ),
            zabbix_enabled=get_val("zabbix_enabled", False),
        ),
        ldap=LdapSettings(
            ldap_server=get_val("ldap_server"),
            ldap_port=get_val("ldap_port", 389),
            ldap_use_ssl=get_val("ldap_use_ssl", False),
            ldap_base_dn=get_val("ldap_base_dn"),
            ldap_bind_dn=get_val("ldap_bind_dn"),
            ldap_bind_password=_mask_sensitive(
                get_val("ldap_bind_password"), "ldap_bind_password"
            ),
            ldap_user_filter=get_val("ldap_user_filter", "(objectClass=user)"),
            ldap_enabled=get_val("ldap_enabled", False),
        ),
    )


@router.get(
    "/{setting_key}",
    response_model=SettingOut,
    dependencies=[Depends(require_it_roles(["admin"]))],
)
def get_setting(
    setting_key: str,
    db: Session = Depends(get_db),
) -> SettingOut:
    """Получить конкретную настройку."""
    setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == setting_key)
        .first()
    )
    if not setting:
        raise HTTPException(status_code=404, detail="Настройка не найдена")

    return SettingOut(
        id=setting.id,
        setting_key=setting.setting_key,
        setting_value=_mask_sensitive(setting.setting_value, setting.setting_key),
        setting_type=setting.setting_type,
        description=setting.description,
        created_at=setting.created_at,
        updated_at=setting.updated_at,
    )


@router.put(
    "/{setting_key}",
    response_model=SettingOut,
    dependencies=[Depends(require_it_roles(["admin"]))],
)
def update_setting(
    setting_key: str,
    payload: SettingUpdate,
    db: Session = Depends(get_db),
) -> SettingOut:
    """Обновить или создать настройку."""
    setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == setting_key)
        .first()
    )

    # Не обновляем пароли если пришло маскированное значение
    if payload.setting_value == "********":
        if setting:
            return SettingOut(
                id=setting.id,
                setting_key=setting.setting_key,
                setting_value=_mask_sensitive(
                    setting.setting_value, setting.setting_key
                ),
                setting_type=setting.setting_type,
                description=setting.description,
                created_at=setting.created_at,
                updated_at=setting.updated_at,
            )
        raise HTTPException(status_code=404, detail="Настройка не найдена")

    if setting:
        # Обновляем существующую
        if payload.setting_value is not None:
            setting.setting_value = str(payload.setting_value)
        if payload.description is not None:
            setting.description = payload.description
    else:
        # Создаём новую
        setting = SystemSettings(
            setting_key=setting_key,
            setting_value=str(payload.setting_value)
            if payload.setting_value is not None
            else None,
            setting_type=_get_setting_type(setting_key),
            description=payload.description,
        )
        db.add(setting)

    db.commit()
    db.refresh(setting)

    return SettingOut(
        id=setting.id,
        setting_key=setting.setting_key,
        setting_value=_mask_sensitive(setting.setting_value, setting.setting_key),
        setting_type=setting.setting_type,
        description=setting.description,
        created_at=setting.created_at,
        updated_at=setting.updated_at,
    )


@router.post(
    "/bulk",
    response_model=List[SettingOut],
    dependencies=[Depends(require_it_roles(["admin"]))],
)
def bulk_update_settings(
    payload: SettingsBulkUpdate,
    db: Session = Depends(get_db),
) -> List[SettingOut]:
    """Массовое обновление настроек."""
    result = []

    for s in payload.settings:
        # Пропускаем маскированные пароли
        if s.setting_value == "********":
            continue

        setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == s.setting_key)
            .first()
        )

        if setting:
            if s.setting_value is not None:
                setting.setting_value = str(s.setting_value)
            if s.description is not None:
                setting.description = s.description
        else:
            setting = SystemSettings(
                setting_key=s.setting_key,
                setting_value=str(s.setting_value)
                if s.setting_value is not None
                else None,
                setting_type=s.setting_type or _get_setting_type(s.setting_key),
                description=s.description,
            )
            db.add(setting)

        db.flush()
        result.append(
            SettingOut(
                id=setting.id,
                setting_key=setting.setting_key,
                setting_value=_mask_sensitive(
                    setting.setting_value, setting.setting_key
                ),
                setting_type=setting.setting_type,
                description=setting.description,
                created_at=setting.created_at,
                updated_at=setting.updated_at,
            )
        )

    db.commit()
    return result


@router.delete("/{setting_key}", dependencies=[Depends(require_it_roles(["admin"]))])
def delete_setting(
    setting_key: str,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить настройку."""
    setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == setting_key)
        .first()
    )
    if not setting:
        raise HTTPException(status_code=404, detail="Настройка не найдена")

    db.delete(setting)
    db.commit()
    return {"message": "Настройка удалена"}


@router.post("/test/smtp", dependencies=[Depends(require_it_roles(["admin"]))])
def test_smtp_connection(db: Session = Depends(get_db)) -> dict:
    """Тестировать SMTP подключение."""
    settings = (
        db.query(SystemSettings)
        .filter(
            SystemSettings.setting_key.in_(
                ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_use_tls"]
            )
        )
        .all()
    )
    settings_dict = {s.setting_key: s.setting_value for s in settings}

    if not settings_dict.get("smtp_host"):
        raise HTTPException(status_code=400, detail="SMTP сервер не настроен")

    # TODO: Реализовать реальное тестирование SMTP
    # import smtplib
    # try:
    #     server = smtplib.SMTP(settings_dict["smtp_host"], int(settings_dict.get("smtp_port", 587)))
    #     if settings_dict.get("smtp_use_tls", "true").lower() == "true":
    #         server.starttls()
    #     if settings_dict.get("smtp_user") and settings_dict.get("smtp_password"):
    #         server.login(settings_dict["smtp_user"], settings_dict["smtp_password"])
    #     server.quit()
    #     return {"status": "success", "message": "SMTP подключение успешно"}
    # except Exception as e:
    #     raise HTTPException(status_code=400, detail=f"Ошибка подключения: {str(e)}")

    return {"status": "pending", "message": "Тестирование SMTP будет реализовано"}


@router.post("/test/imap", dependencies=[Depends(require_it_roles(["admin"]))])
def test_imap_connection(db: Session = Depends(get_db)) -> dict:
    """Тестировать IMAP подключение."""
    settings = (
        db.query(SystemSettings)
        .filter(
            SystemSettings.setting_key.in_(
                ["imap_host", "imap_port", "imap_user", "imap_password", "imap_use_ssl"]
            )
        )
        .all()
    )
    settings_dict = {s.setting_key: s.setting_value for s in settings}

    if not settings_dict.get("imap_host"):
        raise HTTPException(status_code=400, detail="IMAP сервер не настроен")

    # TODO: Реализовать реальное тестирование IMAP
    return {"status": "pending", "message": "Тестирование IMAP будет реализовано"}


@router.post("/test/ldap", dependencies=[Depends(require_it_roles(["admin"]))])
def test_ldap_connection(db: Session = Depends(get_db)) -> dict:
    """Тестировать LDAP/AD подключение."""
    settings = (
        db.query(SystemSettings)
        .filter(
            SystemSettings.setting_key.in_(
                [
                    "ldap_server",
                    "ldap_port",
                    "ldap_bind_dn",
                    "ldap_bind_password",
                    "ldap_use_ssl",
                ]
            )
        )
        .all()
    )
    settings_dict = {s.setting_key: s.setting_value for s in settings}

    if not settings_dict.get("ldap_server"):
        raise HTTPException(status_code=400, detail="LDAP сервер не настроен")

    # TODO: Реализовать реальное тестирование LDAP
    return {"status": "pending", "message": "Тестирование LDAP будет реализовано"}
