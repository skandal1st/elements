import uuid

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.db.base import Base


class User(Base):
    """
    Общая таблица пользователей для всех модулей Elements.
    Используется для аутентификации и базовой информации о пользователе.
    """

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(64), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=True)  # NULL для SSO/AD
    full_name = Column(String(255), nullable=False)

    # Роли по модулям: {"hr": "admin", "it": "user", "doc": "editor"}
    roles = Column(JSONB, default=dict)

    # Контактные данные
    phone = Column(String(32), nullable=True)
    avatar_url = Column(String(512), nullable=True)

    # Статус
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)

    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    def get_role(self, module: str) -> str | None:
        """Получить роль пользователя в конкретном модуле"""
        if self.is_superuser:
            return "admin"
        return self.roles.get(module) if self.roles else None

    def has_role(self, module: str, required_roles: list[str]) -> bool:
        """Проверить, есть ли у пользователя одна из требуемых ролей"""
        if self.is_superuser:
            return True
        role = self.get_role(module)
        return role in required_roles if role else False
