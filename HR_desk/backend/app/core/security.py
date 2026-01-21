from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# Алгоритм JWT (должен совпадать во всех модулях Elements)
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(
    user_id: UUID | str,
    email: str,
    roles: dict[str, str] | None = None,
    is_superuser: bool = False,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Создаёт JWT токен с унифицированным форматом для всех модулей Elements.

    Payload:
        - sub: user_id (UUID)
        - email: email пользователя
        - roles: {"hr": "admin", "it": "user", ...}
        - is_superuser: флаг суперпользователя
        - exp: время истечения
        - iat: время создания
    """
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )

    to_encode = {
        "sub": str(user_id),
        "email": email,
        "roles": roles or {},
        "is_superuser": is_superuser,
        "exp": expire,
        "iat": datetime.utcnow(),
    }

    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    """
    Декодирует JWT токен. Возвращает payload или None при ошибке.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except jwt.JWTError:
        return None
