"""Схемы для системных настроек IT модуля."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class SettingBase(BaseModel):
    """Базовая схема настройки."""

    setting_key: str
    setting_value: Optional[str] = None
    setting_type: str = "general"
    description: Optional[str] = None


class SettingCreate(SettingBase):
    """Схема для создания настройки."""

    pass


class SettingUpdate(BaseModel):
    """Схема для обновления настройки."""

    setting_value: Optional[str] = None
    description: Optional[str] = None


class SettingOut(SettingBase):
    """Схема для вывода настройки."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SettingsBulkUpdate(BaseModel):
    """Схема для массового обновления настроек."""

    settings: List[SettingBase]


# Группы настроек для удобства
class EmailSettings(BaseModel):
    """Настройки SMTP для отправки email."""

    # Флаг включения email-синхронизации (входящие письма + уведомления)
    email_enabled: Optional[bool] = False
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None
    smtp_use_tls: Optional[bool] = True


class ImapSettings(BaseModel):
    """Настройки IMAP для получения email."""

    imap_host: Optional[str] = None
    imap_port: Optional[int] = 993
    imap_user: Optional[str] = None
    imap_password: Optional[str] = None
    imap_use_ssl: Optional[bool] = True
    imap_folder: Optional[str] = "INBOX"
    email_check_interval: Optional[int] = 5  # минуты


class TelegramSettings(BaseModel):
    """Настройки Telegram бота."""

    telegram_bot_token: Optional[str] = None
    telegram_bot_enabled: Optional[bool] = False
    telegram_webhook_url: Optional[str] = None


class ZabbixSettings(BaseModel):
    """Настройки интеграции с Zabbix."""

    zabbix_url: Optional[str] = None
    zabbix_user: Optional[str] = None
    zabbix_password: Optional[str] = None
    zabbix_enabled: Optional[bool] = False


class LdapSettings(BaseModel):
    """Настройки Active Directory / LDAP."""

    ldap_server: Optional[str] = None
    ldap_port: Optional[int] = 389
    ldap_use_ssl: Optional[bool] = False
    ldap_base_dn: Optional[str] = None
    ldap_bind_dn: Optional[str] = None
    ldap_bind_password: Optional[str] = None
    ldap_user_filter: Optional[str] = "(objectClass=user)"
    ldap_enabled: Optional[bool] = False


class GeneralSettings(BaseModel):
    """Общие настройки системы."""

    company_name: Optional[str] = None
    company_logo_url: Optional[str] = None
    system_email: Optional[str] = None
    default_ticket_priority: Optional[str] = "medium"
    auto_assign_tickets: Optional[bool] = False
    ticket_notifications_enabled: Optional[bool] = True


class AllSettings(BaseModel):
    """Все настройки системы."""

    general: GeneralSettings = GeneralSettings()
    email: EmailSettings = EmailSettings()
    imap: ImapSettings = ImapSettings()
    telegram: TelegramSettings = TelegramSettings()
    zabbix: ZabbixSettings = ZabbixSettings()
    ldap: LdapSettings = LdapSettings()
