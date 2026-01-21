from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import PasswordReset, UserCreate, UserOut, UserUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/", response_model=List[UserOut], dependencies=[Depends(require_roles(["admin"]))]
)
def list_users(db: Session = Depends(get_db)) -> List[User]:
    """Получить список всех пользователей (только admin)"""
    return db.query(User).all()


@router.post(
    "/", response_model=UserOut, dependencies=[Depends(require_roles(["admin"]))]
)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Создать нового пользователя (только admin)"""
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(
            status_code=400, detail="Пользователь с таким логином уже существует"
        )
    user = User(
        username=payload.username,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        full_name=payload.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(
        db,
        current_user.username,
        "create",
        "user",
        f"id={user.id}, username={user.username}",
    )
    return user


@router.get(
    "/{user_id}",
    response_model=UserOut,
    dependencies=[Depends(require_roles(["admin"]))],
)
def get_user(user_id: int, db: Session = Depends(get_db)) -> User:
    """Получить пользователя по ID (только admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.patch(
    "/{user_id}",
    response_model=UserOut,
    dependencies=[Depends(require_roles(["admin"]))],
)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Обновить роль пользователя (только admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if payload.role is not None:
        old_role = user.role
        user.role = payload.role
        log_action(
            db,
            current_user.username,
            "update",
            "user",
            f"id={user.id}, role: {old_role} -> {user.role}",
        )
    if payload.full_name is not None:
        user.full_name = payload.full_name
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/{user_id}/reset-password",
    response_model=UserOut,
    dependencies=[Depends(require_roles(["admin"]))],
)
def reset_password(
    user_id: int,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Сбросить пароль пользователя (только admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    db.refresh(user)
    log_action(
        db,
        current_user.username,
        "reset_password",
        "user",
        f"id={user.id}, username={user.username}",
    )
    return user


@router.delete("/{user_id}", dependencies=[Depends(require_roles(["admin"]))])
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Удалить пользователя (только admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
    username = user.username
    db.delete(user)
    db.commit()
    log_action(
        db,
        current_user.username,
        "delete",
        "user",
        f"id={user_id}, username={username}",
    )
    return {"detail": "Пользователь удален"}
