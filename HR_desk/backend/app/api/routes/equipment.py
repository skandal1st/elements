from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.equipment import Equipment
from app.models.user import User
from app.schemas.equipment import EquipmentCreate, EquipmentOut, EquipmentUpdate
from app.services.audit import log_action


router = APIRouter(prefix="/equipment", tags=["equipment"])


@router.get("/", response_model=List[EquipmentOut], dependencies=[Depends(require_roles(["it", "auditor"]))])
def list_equipment(
    db: Session = Depends(get_db),
    employee_id: Optional[int] = Query(default=None),
) -> List[Equipment]:
    query = db.query(Equipment)
    if employee_id:
        query = query.filter(Equipment.employee_id == employee_id)
    return query.all()


@router.post("/", response_model=EquipmentOut, dependencies=[Depends(require_roles(["it"]))])
def create_equipment(
    payload: EquipmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Equipment:
    equipment = Equipment(**payload.model_dump())
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    log_action(db, user.username, "create", "equipment", f"id={equipment.id}")
    return equipment


@router.patch("/{equipment_id}", response_model=EquipmentOut, dependencies=[Depends(require_roles(["it"]))])
def update_equipment(
    equipment_id: int,
    payload: EquipmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Equipment:
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(equipment, field, value)
    db.commit()
    db.refresh(equipment)
    log_action(db, user.username, "update", "equipment", f"id={equipment.id}")
    return equipment
