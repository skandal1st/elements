from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    """Создание нового пользователя"""

    email: EmailStr
    password: str
    full_name: str
    username: Optional[str] = None
    roles: Optional[dict[str, str]] = None  # {"hr": "admin", "it": "user"}


class UserOut(BaseModel):
    """Ответ с данными пользователя"""

    id: UUID
    email: str
    username: Optional[str] = None
    full_name: str
    roles: dict[str, str] = {}
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @property
    def hr_role(self) -> Optional[str]:
        """Роль в HR модуле"""
        return self.roles.get("hr")


class UserUpdate(BaseModel):
    """Обновление пользователя"""

    full_name: Optional[str] = None
    phone: Optional[str] = None
    roles: Optional[dict[str, str]] = None
    is_active: Optional[bool] = None


class PasswordReset(BaseModel):
    """Сброс пароля"""

    new_password: str


class PasswordChange(BaseModel):
    """Смена пароля (с проверкой текущего)"""

    current_password: str
    new_password: str
