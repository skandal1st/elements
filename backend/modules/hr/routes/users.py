"""Роуты /hr/users — управление пользователями (admin)."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.auth import get_password_hash
from backend.modules.hr.dependencies import get_db, get_current_user, require_roles
from backend.modules.hr.models.user import User
from backend.modules.hr.schemas.user import PasswordReset, UserCreate, UserOut, UserUpdate
from backend.modules.hr.services.audit import log_action

router = APIRouter(prefix="/users", tags=["users"])


def _audit_user(user: User) -> str:
    return user.username or user.email


@router.get("/", response_model=List[UserOut], dependencies=[Depends(require_roles(["admin"]))])
def list_users(db: Session = Depends(get_db)) -> List[User]:
    return db.query(User).all()


@router.post("/", response_model=UserOut, dependencies=[Depends(require_roles(["admin"]))])
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    uname = payload.username or payload.email.split("@")[0]
    existing = db.query(User).filter(User.username == uname).first()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    user = User(
        email=payload.email,
        username=uname,
        password_hash=get_password_hash(payload.password),
        full_name=payload.full_name,
        roles=payload.roles or {},
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, _audit_user(current_user), "create", "user", f"id={user.id}, username={user.username}")
    return user


@router.get("/{user_id}", response_model=UserOut, dependencies=[Depends(require_roles(["admin"]))])
def get_user(user_id: UUID, db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.patch("/{user_id}", response_model=UserOut, dependencies=[Depends(require_roles(["admin"]))])
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.roles is not None:
        user.roles = payload.roles
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    log_action(db, _audit_user(current_user), "update", "user", f"id={user.id}")
    return user


@router.post("/{user_id}/reset-password", response_model=UserOut, dependencies=[Depends(require_roles(["admin"]))])
def reset_password(
    user_id: UUID,
    payload: PasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    db.refresh(user)
    log_action(db, _audit_user(current_user), "reset_password", "user", f"id={user.id}, username={user.username}")
    return user


@router.delete("/{user_id}", dependencies=[Depends(require_roles(["admin"]))])
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
    username = user.username or user.email
    db.delete(user)
    db.commit()
    log_action(db, _audit_user(current_user), "delete", "user", f"id={user_id}, username={username}")
    return {"detail": "Пользователь удален"}
