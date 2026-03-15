"""Чтение настроек почтового сервера (IMAP/SMTP) из системных настроек.
Сервер настраивается в разделе «Настройки» → «Интеграция с почтовым сервером»;
пользователь в разделе «Почта» вводит только логин и пароль.
"""
from typing import Optional

from sqlalchemy.orm import Session


# Ключи в system_settings (из модуля IT)
IMAP_KEYS = ("imap_host", "imap_port", "imap_use_ssl", "imap_folder")
SMTP_KEYS = ("smtp_host", "smtp_port", "smtp_use_tls")


def _get_val(settings_dict: dict, key: str, default=None):
    val = settings_dict.get(key)
    if val is None:
        return default
    if isinstance(val, str) and val.lower() in ("true", "false"):
        return val.lower() == "true"
    try:
        return int(val)
    except (ValueError, TypeError):
        pass
    return val


def get_mail_server_settings(db: Session) -> dict:
    """Возвращает настройки сервера из SystemSettings (без паролей)."""
    from backend.modules.hr.models.system_settings import SystemSettings

    keys = list(IMAP_KEYS) + list(SMTP_KEYS)
    rows = db.query(SystemSettings).filter(SystemSettings.setting_key.in_(keys)).all()
    settings_dict = {r.setting_key: r.setting_value for r in rows}

    return {
        "imap_host": _get_val(settings_dict, "imap_host"),
        "imap_port": _get_val(settings_dict, "imap_port", 993),
        "imap_use_ssl": _get_val(settings_dict, "imap_use_ssl", True),
        "imap_folder": _get_val(settings_dict, "imap_folder") or "INBOX",
        "smtp_host": _get_val(settings_dict, "smtp_host"),
        "smtp_port": _get_val(settings_dict, "smtp_port", 587),
        "smtp_use_tls": _get_val(settings_dict, "smtp_use_tls", True),
    }


def get_effective_imap_config(account, server_settings: dict) -> dict:
    """Итоговые IMAP-параметры: из учётки пользователя или из настроек сервера."""
    return {
        "host": account.imap_host or server_settings["imap_host"],
        "port": account.imap_port if account.imap_port is not None else server_settings["imap_port"],
        "ssl": account.imap_ssl if account.imap_ssl is not None else server_settings["imap_use_ssl"],
    }


def get_effective_smtp_config(account, server_settings: dict) -> dict:
    """Итоговые SMTP-параметры: из учётки пользователя или из настроек сервера."""
    return {
        "host": account.smtp_host or server_settings["smtp_host"],
        "port": account.smtp_port if account.smtp_port is not None else server_settings["smtp_port"],
        "ssl": account.smtp_ssl if account.smtp_ssl is not None else server_settings["smtp_use_tls"],
    }
