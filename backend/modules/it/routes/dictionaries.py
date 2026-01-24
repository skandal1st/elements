"""Роуты /it/dictionaries — справочники."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, require_it_roles
from backend.modules.it.models import Dictionary, Ticket, Equipment, Consumable
from backend.modules.it.schemas.dictionary import (
    DictionaryCreate,
    DictionaryOut,
    DictionaryUpdate,
)


router = APIRouter(prefix="/dictionaries", tags=["dictionaries"])


@router.get("/", response_model=List[DictionaryOut])
def list_dictionaries(
    db: Session = Depends(get_db),
    dictionary_type: Optional[str] = Query(None, alias="type"),
) -> List[DictionaryOut]:
    """Получить список справочников (опционально фильтр по типу)"""
    q = db.query(Dictionary)
    
    if dictionary_type:
        q = q.filter(Dictionary.dictionary_type == dictionary_type)
    
    q = q.order_by(Dictionary.dictionary_type, Dictionary.sort_order, Dictionary.label)
    return q.all()


@router.get("/{dictionary_type}/{key}", response_model=DictionaryOut)
def get_dictionary(
    dictionary_type: str,
    key: str,
    db: Session = Depends(get_db),
) -> DictionaryOut:
    """Получить элемент справочника по типу и ключу"""
    dic = db.query(Dictionary).filter(
        Dictionary.dictionary_type == dictionary_type,
        Dictionary.key == key,
    ).first()
    
    if not dic:
        raise HTTPException(status_code=404, detail="Элемент справочника не найден")
    
    return dic


@router.post("/", response_model=DictionaryOut, status_code=201, dependencies=[Depends(require_it_roles(["admin"]))])
def create_dictionary(
    payload: DictionaryCreate,
    db: Session = Depends(get_db),
) -> DictionaryOut:
    """Создать элемент справочника (только admin)"""
    # Проверяем уникальность ключа
    existing = db.query(Dictionary).filter(
        Dictionary.dictionary_type == payload.dictionary_type,
        Dictionary.key == payload.key,
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Элемент с таким ключом уже существует в этом справочнике"
        )
    
    dic = Dictionary(
        dictionary_type=payload.dictionary_type,
        key=payload.key,
        label=payload.label,
        color=payload.color,
        icon=payload.icon,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
        is_system=False,
    )
    db.add(dic)
    db.commit()
    db.refresh(dic)
    return dic


@router.patch("/{dictionary_id}", response_model=DictionaryOut, dependencies=[Depends(require_it_roles(["admin"]))])
def update_dictionary(
    dictionary_id: UUID,
    payload: DictionaryUpdate,
    db: Session = Depends(get_db),
) -> DictionaryOut:
    """Обновить элемент справочника (только admin)"""
    dic = db.query(Dictionary).filter(Dictionary.id == dictionary_id).first()
    if not dic:
        raise HTTPException(status_code=404, detail="Элемент справочника не найден")
    
    # Для системных элементов разрешаем менять только label, color, icon
    if dic.is_system:
        if payload.sort_order is not None or payload.is_active is not None:
            raise HTTPException(
                status_code=400,
                detail="Для системных элементов можно изменять только название, цвет и иконку"
            )
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # Убираем поля, которые нельзя менять для системных элементов
    if dic.is_system:
        update_data.pop("sort_order", None)
        update_data.pop("is_active", None)
    
    for k, v in update_data.items():
        setattr(dic, k, v)
    
    db.commit()
    db.refresh(dic)
    return dic


@router.delete("/{dictionary_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin"]))])
def delete_dictionary(
    dictionary_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить элемент справочника (только admin, только не системные)"""
    dic = db.query(Dictionary).filter(Dictionary.id == dictionary_id).first()
    if not dic:
        raise HTTPException(status_code=404, detail="Элемент справочника не найден")
    
    # Системные элементы нельзя удалять
    if dic.is_system:
        raise HTTPException(
            status_code=400,
            detail="Системные элементы нельзя удалить. Деактивируйте элемент вместо удаления."
        )
    
    # Проверяем использование элемента
    usage_count = 0
    table_name = ""
    
    if dic.dictionary_type == "ticket_category":
        usage_count = db.query(func.count(Ticket.id)).filter(Ticket.category == dic.key).scalar() or 0
        table_name = "тикетах"
    elif dic.dictionary_type == "ticket_priority":
        usage_count = db.query(func.count(Ticket.id)).filter(Ticket.priority == dic.key).scalar() or 0
        table_name = "тикетах"
    elif dic.dictionary_type == "ticket_status":
        usage_count = db.query(func.count(Ticket.id)).filter(Ticket.status == dic.key).scalar() or 0
        table_name = "тикетах"
    elif dic.dictionary_type == "equipment_category":
        usage_count = db.query(func.count(Equipment.id)).filter(Equipment.category == dic.key).scalar() or 0
        table_name = "оборудовании"
    elif dic.dictionary_type == "equipment_status":
        usage_count = db.query(func.count(Equipment.id)).filter(Equipment.status == dic.key).scalar() or 0
        table_name = "оборудовании"
    elif dic.dictionary_type == "consumable_type":
        usage_count = db.query(func.count(Consumable.id)).filter(Consumable.consumable_type == dic.key).scalar() or 0
        table_name = "расходниках"
    
    # Если элемент используется, запрещаем удаление
    if usage_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Невозможно удалить: элемент используется в {usage_count} записях в {table_name}. Деактивируйте элемент вместо удаления."
        )
    
    db.delete(dic)
    db.commit()
    return {"message": "Элемент справочника удален"}
