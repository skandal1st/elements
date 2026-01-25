"""Сервисы IT модуля."""

from .email_receiver import email_receiver
from .email_service import email_service
from .equipment_service import get_equipment_by_owner
from .telegram_service import telegram_service
from .ticket_history import log_ticket_change, log_ticket_changes
from .ticket_service import create_ticket_from_hr
from .zabbix_service import zabbix_service

__all__ = [
    "log_ticket_change",
    "log_ticket_changes",
    "zabbix_service",
    "telegram_service",
    "email_service",
    "email_receiver",
    "create_ticket_from_hr",
    "get_equipment_by_owner",
]
