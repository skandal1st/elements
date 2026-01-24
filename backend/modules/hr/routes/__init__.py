"""
HR API подроуты (employees, departments, positions, hr_requests, …).
Подключаются в api.py с префиксом /hr.
"""

from . import (
    audit,
    birthdays,
    departments,
    employees,
    equipment,
    hr_requests,
    org,
    phonebook,
    positions,
    users,
)

__all__ = [
    "audit",
    "birthdays",
    "departments",
    "employees",
    "equipment",
    "hr_requests",
    "org",
    "phonebook",
    "positions",
    "users",
]
