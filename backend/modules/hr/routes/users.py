"""Роуты /hr/users — управление пользователями (admin)."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.core.auth import get_password_hash
from backend.modules.hr.dependencies import (
    get_db,
    get_current_user,
    require_can_list_users,
    require_superuser,
)
from backend.modules.hr.models.user import User
from backend.modules.hr.models.employee import Employee
from backend.modules.hr.schemas.user import PasswordReset, UserCreate, UserOut, UserUpdate
from backend.modules.hr.services.audit import log_action

# Модели IT модуля, ссылающиеся на users — нужны для корректного удаления пользователя
from backend.modules.it.models import (
    Ticket,
    TicketComment,
    TicketHistory,
    EquipmentHistory,
    ConsumableIssue,
    EquipmentRequest,
    ConsumableSupply,
)

router = APIRouter(prefix="/users", tags=["users"])


def _audit_user(user: User) -> str:
    return user.username or user.email


@router.get("/", response_model=List[UserOut], dependencies=[Depends(require_can_list_users)])
def list_users(db: Session = Depends(get_db)) -> List[User]:
    return db.query(User).all()


@router.post("/", response_model=UserOut, dependencies=[Depends(require_superuser)])
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


@router.get("/{user_id}", response_model=UserOut, dependencies=[Depends(require_superuser)])
def get_user(user_id: UUID, db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.patch("/{user_id}", response_model=UserOut, dependencies=[Depends(require_superuser)])
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


@router.post("/{user_id}/reset-password", response_model=UserOut, dependencies=[Depends(require_superuser)])
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


def _clear_user_references(db: Session, user_id: UUID) -> None:
    """Обнуляет ссылки на пользователя в полях, где это допустимо (nullable)."""
    db.query(Employee).filter(Employee.user_id == user_id).update(
        {"user_id": None}, synchronize_session=False
    )
    db.query(Ticket).filter(Ticket.creator_id == user_id).update(
        {"creator_id": None}, synchronize_session=False
    )
    db.query(Ticket).filter(Ticket.assignee_id == user_id).update(
        {"assignee_id": None}, synchronize_session=False
    )
    db.query(EquipmentRequest).filter(EquipmentRequest.reviewer_id == user_id).update(
        {"reviewer_id": None}, synchronize_session=False
    )


def _blocking_references(db: Session, user_id: UUID) -> list[str]:
    """Проверяет, есть ли записи, которые не позволяют удалить пользователя (NOT NULL FK)."""
    blocks = []
    if db.query(TicketComment).filter(TicketComment.user_id == user_id).limit(1).first():
        blocks.append("комментарии к заявкам")
    if db.query(TicketHistory).filter(TicketHistory.changed_by_id == user_id).limit(1).first():
        blocks.append("история изменений заявок")
    if db.query(EquipmentHistory).filter(EquipmentHistory.changed_by_id == user_id).limit(1).first():
        blocks.append("история перемещений оборудования")
    if (
        db.query(ConsumableIssue)
        .filter(
            or_(
                ConsumableIssue.issued_to_id == user_id,
                ConsumableIssue.issued_by_id == user_id,
            )
        )
        .limit(1)
        .first()
    ):
        blocks.append("выдача расходных материалов")
    if db.query(EquipmentRequest).filter(EquipmentRequest.requester_id == user_id).limit(1).first():
        blocks.append("заявки на оборудование (инициатор)")
    if (
        db.query(ConsumableSupply).filter(ConsumableSupply.created_by_id == user_id).limit(1).first()
    ):
        blocks.append("поставки расходных материалов")
    return blocks


@router.delete("/{user_id}", dependencies=[Depends(require_superuser)])
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

    blocking = _blocking_references(db, user_id)
    if blocking:
        raise HTTPException(
            status_code=400,
            detail=(
                "Невозможно удалить пользователя: он связан с — "
                + ", ".join(blocking)
                + ". Удалите или переназначьте эти записи в модуле IT."
            ),
        )

    username = user.username or user.email
    _clear_user_references(db, user_id)
    db.delete(user)
    db.commit()
    log_action(db, _audit_user(current_user), "delete", "user", f"id={user_id}, username={username}")
    return {"detail": "Пользователь удален"}
