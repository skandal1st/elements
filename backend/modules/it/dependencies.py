"""
Dependencies для IT модуля.
get_db и get_current_user — общие с core; require_it_roles по User (аналог HR).
"""
from typing import Sequence
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.core.auth import get_token_payload
from backend.core.database import get_db as core_get_db
from backend.modules.hr.models.user import User

get_db = core_get_db


def get_current_user(
    db: Session = Depends(get_db),
    payload: dict = Depends(get_token_payload),
) -> User:
    """Текущий пользователь из JWT (core.auth + User)."""
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный формат токена",
        )
    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный формат user_id",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь деактивирован",
        )
    return user


def require_it_roles(allowed_roles: Sequence[str]):
    """
    Проверяет роль в модуле IT.
    Разрешает: is_superuser, role in allowed_roles, либо role == "admin".
    """

    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.is_superuser:
            return user
        role = user.get_role("it")
        if not role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Нет доступа к модулю IT",
            )
        if role in allowed_roles or role == "admin":
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Недостаточно прав. Требуется одна из ролей: {', '.join(allowed_roles)}",
        )

    return _checker
