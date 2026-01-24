"""Роуты /it/equipment/{equipment_id}/history — история перемещений оборудования."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.it.models import Equipment, EquipmentHistory
from backend.modules.it.schemas.equipment_history import EquipmentHistoryOut
from backend.modules.hr.models.user import User


router = APIRouter(prefix="/equipment/{equipment_id}/history", tags=["equipment-history"])


@router.get("/", response_model=List[EquipmentHistoryOut])
def get_equipment_history(
    equipment_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> List[EquipmentHistoryOut]:
    """Получить историю перемещений оборудования"""
    # Проверяем существование оборудования
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")
    
    # Получаем историю с информацией о пользователях
    history = (
        db.query(EquipmentHistory)
        .filter(EquipmentHistory.equipment_id == equipment_id)
        .order_by(EquipmentHistory.created_at.desc())
        .all()
    )
    
    # Формируем ответ с именами пользователей
    result = []
    for record in history:
        record_dict = {
            "id": record.id,
            "equipment_id": record.equipment_id,
            "from_user_id": record.from_user_id,
            "to_user_id": record.to_user_id,
            "from_location": record.from_location,
            "to_location": record.to_location,
            "reason": record.reason,
            "changed_by_id": record.changed_by_id,
            "created_at": record.created_at,
        }
        
        # Добавляем информацию о пользователях
        if record.from_user_id:
            from_user = db.query(User).filter(User.id == record.from_user_id).first()
            if from_user:
                record_dict["from_user_name"] = from_user.full_name
        
        if record.to_user_id:
            to_user = db.query(User).filter(User.id == record.to_user_id).first()
            if to_user:
                record_dict["to_user_name"] = to_user.full_name
        
        changed_by = db.query(User).filter(User.id == record.changed_by_id).first()
        if changed_by:
            record_dict["changed_by_name"] = changed_by.full_name
        
        result.append(EquipmentHistoryOut(**record_dict))
    
    return result
