"""Роуты /it/rooms — кабинеты (комнаты)."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.it.models import Room, Building, Equipment
from backend.modules.it.schemas.room import (
    RoomCreate,
    RoomOut,
    RoomUpdate,
    RoomWithDetails,
)
from backend.modules.hr.models.user import User
from backend.modules.hr.models.employee import Employee


router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/", response_model=List[RoomOut])
def list_rooms(
    db: Session = Depends(get_db),
    building_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
) -> List[RoomOut]:
    """Получить список кабинетов"""
    q = db.query(Room).join(Building)
    
    if building_id:
        q = q.filter(Room.building_id == building_id)
    if is_active is not None:
        q = q.filter(Room.is_active == is_active)
    
    results = q.order_by(Building.name, Room.floor, Room.name).all()
    
    # Добавляем building_name
    for r in results:
        r.building_name = r.building.name if r.building else None
    
    return results


@router.get("/{room_id}", response_model=RoomWithDetails)
def get_room(
    room_id: UUID,
    db: Session = Depends(get_db),
) -> RoomWithDetails:
    """Получить кабинет с деталями"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Кабинет не найден")
    
    # Подсчитываем оборудование и сотрудников
    equipment_count = db.query(func.count(Equipment.id)).filter(
        Equipment.room_id == room_id
    ).scalar() or 0
    
    employees_count = db.query(func.count(Employee.id)).filter(
        Employee.room_id == room_id
    ).scalar() or 0
    
    result = RoomWithDetails(
        id=room.id,
        building_id=room.building_id,
        name=room.name,
        floor=room.floor,
        description=room.description,
        is_active=room.is_active,
        created_at=room.created_at,
        updated_at=room.updated_at,
        building_name=room.building.name if room.building else None,
        equipment_count=equipment_count,
        employees_count=employees_count,
    )
    
    return result


@router.post("/", response_model=RoomOut, status_code=201, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def create_room(
    payload: RoomCreate,
    db: Session = Depends(get_db),
) -> RoomOut:
    """Создать кабинет"""
    # Проверяем существование здания
    building = db.query(Building).filter(Building.id == payload.building_id).first()
    if not building:
        raise HTTPException(status_code=404, detail="Здание не найдено")
    
    # Проверяем уникальность названия в рамках здания
    existing = db.query(Room).filter(
        Room.building_id == payload.building_id,
        Room.name == payload.name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Кабинет с таким названием уже существует в этом здании")
    
    room = Room(**payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    room.building_name = building.name
    return room


@router.patch("/{room_id}", response_model=RoomOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def update_room(
    room_id: UUID,
    payload: RoomUpdate,
    db: Session = Depends(get_db),
) -> RoomOut:
    """Обновить кабинет"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Кабинет не найден")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # Проверка уникальности при изменении названия
    if "name" in update_data and update_data["name"] != room.name:
        existing = db.query(Room).filter(
            Room.building_id == room.building_id,
            Room.name == update_data["name"],
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Кабинет с таким названием уже существует в этом здании")
    
    for k, v in update_data.items():
        setattr(room, k, v)
    
    db.commit()
    db.refresh(room)
    room.building_name = room.building.name if room.building else None
    return room


@router.delete("/{room_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin"]))])
def delete_room(
    room_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить кабинет (только admin)"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Кабинет не найден")
    
    # Проверяем использование
    equipment_count = db.query(func.count(Equipment.id)).filter(
        Equipment.room_id == room_id
    ).scalar() or 0
    
    employees_count = db.query(func.count(Employee.id)).filter(
        Employee.room_id == room_id
    ).scalar() or 0
    
    if equipment_count > 0 or employees_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Невозможно удалить: кабинет используется ({equipment_count} единиц оборудования, {employees_count} сотрудников)"
        )
    
    db.delete(room)
    db.commit()
    return {"message": "Кабинет удален"}


@router.get("/{room_id}/equipment", response_model=List[dict])
def get_room_equipment(
    room_id: UUID,
    db: Session = Depends(get_db),
) -> List[dict]:
    """Получить оборудование в кабинете"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Кабинет не найден")
    
    equipment = db.query(Equipment).filter(
        Equipment.room_id == room_id,
        or_(Equipment.status == "in_use", Equipment.status == "in_stock"),  # Только активное оборудование
    ).all()

    owner_ids = [eq.current_owner_id for eq in equipment if eq.current_owner_id]
    owners_map = {}
    if owner_ids:
        owners = db.query(Employee).filter(Employee.id.in_(owner_ids)).all()
        owners_map = {o.id: o.full_name for o in owners}

    return [
        {
            "id": str(eq.id),
            "name": eq.name,
            "inventory_number": eq.inventory_number,
            "category": eq.category,
            "status": eq.status,
            "owner_name": owners_map.get(eq.current_owner_id) if eq.current_owner_id else None,
        }
        for eq in equipment
    ]
