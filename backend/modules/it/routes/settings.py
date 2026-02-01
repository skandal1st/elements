"""Роуты /it/settings — системные настройки IT модуля."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.dependencies import require_superuser
from backend.modules.it.dependencies import get_db
from backend.modules.it.schemas.settings import (
    AllSettings,
    EmailSettings,
    GeneralSettings,
    ImapSettings,
    LlmSettings,
    LdapSettings,
    RocketChatSettings,
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
        "public_app_url",
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
        "email_enabled",
        "email_from",
        "email_from_name",
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
    "telegram": ["telegram_bot_token", "telegram_bot_enabled", "telegram_webhook_url", "telegram_bot_username"],
    "rocketchat": [
        "rocketchat_enabled", "rocketchat_url", "rocketchat_user_id",
        "rocketchat_auth_token", "rocketchat_webhook_token",
        "rocketchat_channel_name", "rocketchat_bot_user_id",
    ],
    "zabbix": ["zabbix_url", "zabbix_api_token", "zabbix_enabled"],
    "ldap": [
        "ldap_server",
        "ldap_port",
        "ldap_use_ssl",
        "ldap_base_dn",
        "ldap_bind_dn",
        "ldap_bind_password",
        "ldap_user_filter",
        "ldap_enabled",
        "scan_gateway_host",
        "scan_gateway_port",
        "scan_gateway_use_ssl",
        "scan_gateway_username",
    ],
    "llm": [
        "llm_normalization_enabled",
        "llm_suggestions_enabled",
        "openrouter_api_key",
        "openrouter_base_url",
        "openrouter_model",
        "openrouter_embedding_model",
        "qdrant_url",
        "qdrant_collection",
    ],
}

# Настройки, которые должны быть скрыты при выводе (пароли и т.д.)
SENSITIVE_KEYS = [
    "smtp_password",
    "imap_password",
    "telegram_bot_token",
    "rocketchat_auth_token",
    "rocketchat_webhook_token",
    "zabbix_api_token",
    "ldap_bind_password",
    "openrouter_api_key",
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
    dependencies=[Depends(require_superuser)],
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
    dependencies=[Depends(require_superuser)],
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
            public_app_url=get_val("public_app_url"),
            default_ticket_priority=get_val("default_ticket_priority", "medium"),
            auto_assign_tickets=get_val("auto_assign_tickets", False),
            ticket_notifications_enabled=get_val("ticket_notifications_enabled", True),
        ),
        email=EmailSettings(
            email_enabled=get_val("email_enabled", False),
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
        rocketchat=RocketChatSettings(
            rocketchat_enabled=get_val("rocketchat_enabled", False),
            rocketchat_url=get_val("rocketchat_url"),
            rocketchat_user_id=get_val("rocketchat_user_id"),
            rocketchat_auth_token=_mask_sensitive(
                get_val("rocketchat_auth_token"), "rocketchat_auth_token"
            ),
            rocketchat_webhook_token=_mask_sensitive(
                get_val("rocketchat_webhook_token"), "rocketchat_webhook_token"
            ),
            rocketchat_channel_name=get_val("rocketchat_channel_name"),
            rocketchat_bot_user_id=get_val("rocketchat_bot_user_id"),
        ),
        zabbix=ZabbixSettings(
            zabbix_url=get_val("zabbix_url"),
            zabbix_api_token=_mask_sensitive(
                get_val("zabbix_api_token"), "zabbix_api_token"
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
            scan_gateway_host=get_val("scan_gateway_host"),
            scan_gateway_port=get_val("scan_gateway_port", 5985),
            scan_gateway_use_ssl=get_val("scan_gateway_use_ssl", False),
            scan_gateway_username=get_val("scan_gateway_username"),
        ),
        llm=LlmSettings(
            llm_normalization_enabled=get_val("llm_normalization_enabled", False),
            llm_suggestions_enabled=get_val("llm_suggestions_enabled", False),
            openrouter_api_key=_mask_sensitive(
                get_val("openrouter_api_key"), "openrouter_api_key"
            ),
            openrouter_base_url=get_val(
                "openrouter_base_url", "https://openrouter.ai/api/v1"
            ),
            openrouter_model=get_val("openrouter_model", "openai/gpt-4o-mini"),
            openrouter_embedding_model=get_val(
                "openrouter_embedding_model", "openai/text-embedding-3-small"
            ),
            qdrant_url=get_val("qdrant_url"),
            qdrant_collection=get_val("qdrant_collection", "knowledge_articles_v1"),
        ),
    )


@router.get(
    "/{setting_key}",
    response_model=SettingOut,
    dependencies=[Depends(require_superuser)],
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
    dependencies=[Depends(require_superuser)],
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
    dependencies=[Depends(require_superuser)],
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


@router.delete("/{setting_key}", dependencies=[Depends(require_superuser)])
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


@router.post("/test/smtp", dependencies=[Depends(require_superuser)])
def test_smtp_connection(db: Session = Depends(get_db)) -> dict:
    """Тестировать SMTP подключение."""
    import smtplib
    import ssl

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

    server = None
    try:
        host = settings_dict["smtp_host"]
        port = int(settings_dict.get("smtp_port") or 587)
        use_tls = settings_dict.get("smtp_use_tls", "true").lower() == "true"
        user = settings_dict.get("smtp_user")
        password = settings_dict.get("smtp_password")

        # Порт 465 использует SSL сразу, 587 использует STARTTLS
        if port == 465:
            # Implicit SSL
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(host, port, timeout=15, context=context)
        else:
            # STARTTLS для портов 25, 587 и других
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            if use_tls:
                context = ssl.create_default_context()
                server.starttls(context=context)
                server.ehlo()

        if user and password:
            server.login(user, password)

        server.quit()
        return {
            "status": "success",
            "message": f"SMTP подключение к {host}:{port} успешно",
        }
    except smtplib.SMTPAuthenticationError as e:
        return {
            "status": "error",
            "message": f"Ошибка аутентификации SMTP: {e.smtp_code} - {e.smtp_error.decode() if isinstance(e.smtp_error, bytes) else e.smtp_error}",
        }
    except smtplib.SMTPConnectError as e:
        return {
            "status": "error",
            "message": f"Не удалось подключиться к SMTP серверу: {str(e)}",
        }
    except smtplib.SMTPServerDisconnected as e:
        return {"status": "error", "message": f"Сервер разорвал соединение: {str(e)}"}
    except ssl.SSLError as e:
        return {"status": "error", "message": f"Ошибка SSL: {str(e)}"}
    except TimeoutError:
        return {"status": "error", "message": "Таймаут подключения к SMTP серверу"}
    except ConnectionRefusedError:
        return {
            "status": "error",
            "message": f"Подключение отклонено сервером {host}:{port}",
        }
    except OSError as e:
        return {"status": "error", "message": f"Сетевая ошибка: {str(e)}"}
    except Exception as e:
        return {
            "status": "error",
            "message": f"Ошибка SMTP: {type(e).__name__}: {str(e)}",
        }
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass


@router.post("/test/imap", dependencies=[Depends(require_superuser)])
def test_imap_connection(db: Session = Depends(get_db)) -> dict:
    """Тестировать IMAP подключение."""
    import imaplib
    import ssl

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

    server = None
    try:
        host = settings_dict["imap_host"]
        port = int(settings_dict.get("imap_port") or 993)
        use_ssl = settings_dict.get("imap_use_ssl", "true").lower() == "true"
        user = settings_dict.get("imap_user")
        password = settings_dict.get("imap_password")

        if use_ssl:
            context = ssl.create_default_context()
            server = imaplib.IMAP4_SSL(host, port, ssl_context=context)
        else:
            server = imaplib.IMAP4(host, port)

        if user and password:
            server.login(user, password)

        server.logout()
        return {
            "status": "success",
            "message": f"IMAP подключение к {host}:{port} успешно",
        }
    except imaplib.IMAP4.error as e:
        return {"status": "error", "message": f"Ошибка IMAP: {str(e)}"}
    except ssl.SSLError as e:
        return {"status": "error", "message": f"Ошибка SSL: {str(e)}"}
    except TimeoutError:
        return {"status": "error", "message": "Таймаут подключения к IMAP серверу"}
    except ConnectionRefusedError:
        return {
            "status": "error",
            "message": f"Подключение отклонено сервером {host}:{port}",
        }
    except OSError as e:
        return {"status": "error", "message": f"Сетевая ошибка: {str(e)}"}
    except Exception as e:
        return {
            "status": "error",
            "message": f"Ошибка IMAP: {type(e).__name__}: {str(e)}",
        }
    finally:
        if server:
            try:
                server.logout()
            except Exception:
                pass


@router.post("/test/ldap", dependencies=[Depends(require_superuser)])
def test_ldap_connection(db: Session = Depends(get_db)) -> dict:
    """Тестировать LDAP/AD подключение."""
    import socket

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

    try:
        host = settings_dict["ldap_server"]
        port = int(settings_dict.get("ldap_port", 389))
        use_ssl = settings_dict.get("ldap_use_ssl", "false").lower() == "true"

        # Проверяем доступность порта
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host, port))
        sock.close()

        if result != 0:
            raise HTTPException(
                status_code=400,
                detail=f"Не удалось подключиться к LDAP серверу {host}:{port}",
            )

        # Попытка подключения через ldap3 если установлен
        try:
            import ldap3
            from ldap3 import ALL, Connection, Server

            server = Server(
                host, port=port, use_ssl=use_ssl, get_info=ALL, connect_timeout=5
            )

            bind_dn = settings_dict.get("ldap_bind_dn")
            bind_password = settings_dict.get("ldap_bind_password")

            if bind_dn and bind_password:
                conn = Connection(
                    server, user=bind_dn, password=bind_password, auto_bind=True
                )
                conn.unbind()
                return {
                    "status": "success",
                    "message": "LDAP подключение и аутентификация успешны",
                }
            else:
                conn = Connection(server, auto_bind=True)
                conn.unbind()
                return {
                    "status": "success",
                    "message": "LDAP подключение успешно (анонимный доступ)",
                }

        except ImportError:
            # ldap3 не установлен, возвращаем результат проверки порта
            return {
                "status": "success",
                "message": f"LDAP сервер {host}:{port} доступен (установите ldap3 для полной проверки)",
            }
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Ошибка LDAP аутентификации: {str(e)}"
            )

    except socket.timeout:
        raise HTTPException(
            status_code=400, detail="Таймаут подключения к LDAP серверу"
        )
    except socket.gaierror:
        raise HTTPException(
            status_code=400, detail=f"Не удалось разрешить имя хоста: {host}"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка LDAP: {str(e)}")


@router.post("/test/telegram", dependencies=[Depends(require_superuser)])
async def test_telegram_connection(db: Session = Depends(get_db)) -> dict:
    """Тестировать подключение к Telegram Bot API."""
    from backend.modules.it.services.telegram_service import telegram_service

    bot_info = await telegram_service.get_bot_info(db)
    if not bot_info:
        return {
            "status": "error",
            "message": "Не удалось подключиться к Telegram Bot API. Проверьте токен бота.",
        }

    # Сохраняем username бота в настройках
    bot_username = bot_info.get("username", "")
    if bot_username:
        setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == "telegram_bot_username")
            .first()
        )
        if setting:
            setting.setting_value = bot_username
        else:
            setting = SystemSettings(
                setting_key="telegram_bot_username",
                setting_value=bot_username,
                setting_type="telegram",
                description="Username Telegram бота (заполняется автоматически)",
            )
            db.add(setting)
        db.commit()

    # Перезапускаем polling чтобы подхватить новые настройки
    try:
        await telegram_service.restart_polling()
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Telegram бот @{bot_username} подключен успешно",
    }


@router.post("/test/rocketchat", dependencies=[Depends(require_superuser)])
async def test_rocketchat_connection(db: Session = Depends(get_db)) -> dict:
    """Тестировать подключение к RocketChat."""
    from backend.modules.it.services.rocketchat_service import rocketchat_service

    result = await rocketchat_service.check_connection(db)
    if result:
        # Перезапускаем polling чтобы подхватить новые настройки
        try:
            await rocketchat_service.restart_polling()
        except Exception:
            pass
        return {
            "status": "success",
            "message": "RocketChat подключён успешно. Polling перезапущен.",
        }
    return {
        "status": "error",
        "message": "Не удалось подключиться к RocketChat. Проверьте URL, User ID и Auth Token.",
    }


@router.post("/ldap/sync-employees", dependencies=[Depends(require_superuser)])
def ldap_sync_employees(
    db: Session = Depends(get_db),
    dry_run: bool = False,
    mark_missing_dismissed: bool = False,
) -> dict:
    """
    Синхронизировать сотрудников HR из Active Directory (LDAP).

    - dry_run=true: только посчитать изменения (без записи в БД)
    - mark_missing_dismissed=true: помечать отсутствующих в AD как dismissed (ОСТОРОЖНО)
    """
    from backend.modules.hr.services.ad_employee_sync import sync_employees_from_ldap

    try:
        result = sync_employees_from_ldap(
            db=db,
            dry_run=dry_run,
            mark_missing_dismissed=mark_missing_dismissed,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ADUserOut(BaseModel):
    dn: Optional[str] = None
    sAMAccountName: str
    displayName: Optional[str] = None
    mail: Optional[str] = None
    userPrincipalName: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    enabled: bool = True
    imported: bool = False


class ADSyncSelectedRequest(BaseModel):
    usernames: List[str] = Field(default_factory=list)
    clear_before: bool = False
    dry_run: bool = False


@router.get("/ldap/ad-users", response_model=List[ADUserOut], dependencies=[Depends(require_superuser)])
def ldap_list_ad_users(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[ADUserOut]:
    """
    Получить список пользователей из AD для выбора в UI (с поиском).
    """
    from backend.modules.hr.services.ad_employee_sync import fetch_ad_users

    try:
        users = fetch_ad_users(db=db, q=q)
        return [ADUserOut(**u) for u in users]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ldap/clear-employees", dependencies=[Depends(require_superuser)])
def ldap_clear_employees(db: Session = Depends(get_db), dry_run: bool = False) -> dict:
    """
    "Очистить" список сотрудников из AD: пометить всех сотрудников с external_id как dismissed.
    """
    from backend.modules.hr.services.ad_employee_sync import dismiss_all_ad_employees

    try:
        return dismiss_all_ad_employees(db=db, dry_run=dry_run)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ldap/sync-selected", dependencies=[Depends(require_superuser)])
def ldap_sync_selected(payload: ADSyncSelectedRequest, db: Session = Depends(get_db)) -> dict:
    """
    Синхронизировать сотрудников HR из AD только для выбранных логинов.
    """
    from backend.modules.hr.services.ad_employee_sync import sync_selected_employees_from_ldap

    try:
        return sync_selected_employees_from_ldap(
            db=db,
            usernames=payload.usernames,
            clear_before=payload.clear_before,
            dry_run=payload.dry_run,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
