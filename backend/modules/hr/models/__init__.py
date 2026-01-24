"""
Модели HR модуля
"""
from .user import User
from .employee import Employee
from .department import Department
from .position import Position
from .hr_request import HRRequest
from .equipment import HREquipment
from .audit_log import AuditLog
from .system_settings import SystemSettings

__all__ = [
    "User",
    "Employee",
    "Department",
    "Position",
    "HRRequest",
    "HREquipment",
    "AuditLog",
    "SystemSettings",
]
