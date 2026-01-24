"""
База данных для IT модуля

Использует единую БД из backend.core.database
Этот файл оставлен для обратной совместимости.
Используйте backend.core.database.get_db напрямую.
"""
from backend.core.database import Base, SessionLocal, engine, get_db

__all__ = ["Base", "SessionLocal", "engine", "get_db"]
