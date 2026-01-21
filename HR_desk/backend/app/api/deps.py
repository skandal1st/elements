from typing import Generator, Sequence
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")

# Модуль для проверки ролей
MODULE_NAME = "hr"


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """
    Получает текущего пользователя из JWT токена.
    Токен может быть создан любым модулем Elements (единый формат).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    user_id_str: str | None = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь деактивирован",
        )

    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    token: str | None = Depends(
        OAuth2PasswordBearer(
            tokenUrl=f"{settings.api_v1_prefix}/auth/login", auto_error=False
        )
    ),
) -> User | None:
    """
    Получает текущего пользователя, если токен предоставлен.
    Возвращает None если токен отсутствует.
    """
    if token is None:
        return None

    payload = decode_token(token)
    if payload is None:
        return None

    user_id_str = payload.get("sub")
    if user_id_str is None:
        return None

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        return None

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    return user


def require_roles(allowed_roles: Sequence[str]):
    """
    Проверяет, что у пользователя есть одна из требуемых ролей в HR модуле.

    Пример использования:
        @router.get("/", dependencies=[Depends(require_roles(["admin", "hr"]))])
    """

    def _role_checker(user: User = Depends(get_current_user)) -> User:
        # Superuser имеет доступ ко всему
        if user.is_superuser:
            return user

        # Проверяем роль в HR модуле
        user_role = user.get_role(MODULE_NAME)

        if user_role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к модулю HR",
            )

        if user_role not in allowed_roles and "admin" not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Недостаточно прав. Требуется одна из ролей: {', '.join(allowed_roles)}",
            )

        return user

    return _role_checker


def require_superuser(user: User = Depends(get_current_user)) -> User:
    """Требует права суперпользователя"""
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права суперпользователя",
        )
    return user
