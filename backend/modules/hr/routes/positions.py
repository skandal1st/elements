"""Роуты /hr/positions."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.hr.dependencies import get_db, get_current_user, require_roles
from backend.modules.hr.models.position import Position
from backend.modules.hr.models.user import User
from backend.modules.hr.schemas.position import PositionCreate, PositionOut, PositionUpdate
from backend.modules.hr.services.audit import log_action

router = APIRouter(prefix="/positions", tags=["positions"])


def _audit_user(user: User) -> str:
    return user.username or user.email


@router.get("/", response_model=List[PositionOut])
def list_positions(db: Session = Depends(get_db)) -> List[Position]:
    return db.query(Position).all()


@router.post("/", response_model=PositionOut, dependencies=[Depends(require_roles(["hr"]))])
def create_position(
    payload: PositionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Position:
    position = Position(**payload.model_dump())
    db.add(position)
    db.commit()
    db.refresh(position)
    log_action(db, _audit_user(user), "create", "position", f"id={position.id}")
    return position


@router.patch("/{position_id}", response_model=PositionOut, dependencies=[Depends(require_roles(["hr"]))])
def update_position(
    position_id: int,
    payload: PositionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Position:
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(position, field, value)
    db.commit()
    db.refresh(position)
    log_action(db, _audit_user(user), "update", "position", f"id={position.id}")
    return position


@router.delete("/{position_id}", status_code=204, dependencies=[Depends(require_roles(["hr"]))])
def delete_position(
    position_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Должность не найдена")
    
    # Открепляем сотрудников от этой должности
    from backend.modules.hr.models.employee import Employee
    db.query(Employee).filter(Employee.position_id == position_id).update(
        {Employee.position_id: None}
    )
    
    position_name = position.name
    db.delete(position)
    db.commit()
    log_action(db, _audit_user(user), "delete", "position", f"id={position_id}, name={position_name}")
