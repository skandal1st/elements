from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.position import Position
from app.models.user import User
from app.schemas.position import PositionCreate, PositionOut, PositionUpdate
from app.services.audit import log_action


router = APIRouter(prefix="/positions", tags=["positions"])


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
    log_action(db, user.username, "create", "position", f"id={position.id}")
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
    log_action(db, user.username, "update", "position", f"id={position.id}")
    return position
