"""Роуты /it/buildings — здания."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.it.models import Building
from backend.modules.it.schemas.building import BuildingCreate, BuildingOut, BuildingUpdate
from backend.modules.hr.models.user import User

router = APIRouter(prefix="/buildings", tags=["buildings"])


@router.get("/", response_model=List[BuildingOut], dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))])
def list_buildings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active: Optional[bool] = Query(None),
) -> List[Building]:
    q = db.query(Building).order_by(Building.name)
    role = "admin" if current_user.is_superuser else (current_user.get_role("it") or "employee")
    if active is True or role != "admin":
        q = q.filter(Building.is_active == True)
    return q.all()


@router.get("/{building_id}", response_model=BuildingOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))])
def get_building(
    building_id: UUID,
    db: Session = Depends(get_db),
) -> Building:
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Здание не найдено")
    return b


@router.post("/", response_model=BuildingOut, status_code=201, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def create_building(
    payload: BuildingCreate,
    db: Session = Depends(get_db),
) -> Building:
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Название здания обязательно")
    existing = db.query(Building).filter(Building.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Здание с таким названием уже существует")
    b = Building(
        name=name,
        address=(payload.address or "").strip() or None,
        description=(payload.description or "").strip() or None,
        is_active=payload.is_active,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.patch("/{building_id}", response_model=BuildingOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def update_building(
    building_id: UUID,
    payload: BuildingUpdate,
    db: Session = Depends(get_db),
) -> Building:
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Здание не найдено")
    if payload.name is not None:
        n = payload.name.strip()
        if not n:
            raise HTTPException(status_code=400, detail="Название здания не может быть пустым")
        if n != b.name:
            ex = db.query(Building).filter(Building.name == n, Building.id != building_id).first()
            if ex:
                raise HTTPException(status_code=400, detail="Здание с таким названием уже существует")
        b.name = n
    if payload.address is not None:
        b.address = payload.address.strip() or None
    if payload.description is not None:
        b.description = payload.description.strip() or None
    if payload.is_active is not None:
        b.is_active = payload.is_active
    db.commit()
    db.refresh(b)
    return b


@router.delete("/{building_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin"]))])
def delete_building(
    building_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    b = db.query(Building).filter(Building.id == building_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Здание не найдено")
    db.delete(b)
    db.commit()
    return {"message": "Здание успешно удалено"}
