"""Роуты /it/consumables — расходные материалы."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db, require_it_roles
from backend.modules.it.models import Consumable, ConsumableIssue, ConsumableSupply
from backend.modules.it.schemas.consumable import (
    ConsumableCreate,
    ConsumableIssueCreate,
    ConsumableIssueOut,
    ConsumableOut,
    ConsumableSupplyCreate,
    ConsumableSupplyOut,
    ConsumableUpdate,
)

router = APIRouter(prefix="/consumables", tags=["consumables"])


@router.get("/", response_model=List[ConsumableOut])
def list_consumables(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> List[ConsumableOut]:
    """Получить список расходных материалов"""
    q = db.query(Consumable)

    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Consumable.name.ilike(s),
                Consumable.model.ilike(s) if Consumable.model else False,
            )
        )

    if category:
        q = q.filter(Consumable.category == category)

    q = q.order_by(Consumable.name)
    offset = (page - 1) * page_size
    return q.offset(offset).limit(page_size).all()


@router.get("/{consumable_id}", response_model=ConsumableOut)
def get_consumable(
    consumable_id: UUID,
    db: Session = Depends(get_db),
) -> ConsumableOut:
    """Получить расходный материал по ID"""
    consumable = db.query(Consumable).filter(Consumable.id == consumable_id).first()
    if not consumable:
        raise HTTPException(status_code=404, detail="Расходный материал не найден")
    return consumable


@router.post(
    "/",
    response_model=ConsumableOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_consumable(
    payload: ConsumableCreate,
    db: Session = Depends(get_db),
) -> ConsumableOut:
    """Создать расходный материал"""
    data = payload.model_dump()
    consumable = Consumable(**data)
    db.add(consumable)
    db.commit()
    db.refresh(consumable)
    return consumable


@router.patch(
    "/{consumable_id}",
    response_model=ConsumableOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def update_consumable(
    consumable_id: UUID,
    payload: ConsumableUpdate,
    db: Session = Depends(get_db),
) -> ConsumableOut:
    """Обновить расходный материал"""
    consumable = db.query(Consumable).filter(Consumable.id == consumable_id).first()
    if not consumable:
        raise HTTPException(status_code=404, detail="Расходный материал не найден")

    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(consumable, k, v)

    db.commit()
    db.refresh(consumable)
    return consumable


@router.delete(
    "/{consumable_id}",
    status_code=200,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def delete_consumable(
    consumable_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить расходный материал"""
    consumable = db.query(Consumable).filter(Consumable.id == consumable_id).first()
    if not consumable:
        raise HTTPException(status_code=404, detail="Расходный материал не найден")

    db.delete(consumable)
    db.commit()
    return {"message": "Расходный материал удален"}


@router.get("/issues/", response_model=List[ConsumableIssueOut])
def list_consumable_issues(
    db: Session = Depends(get_db),
    consumable_id: Optional[UUID] = Query(None),
    issued_to_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> List[ConsumableIssueOut]:
    """Получить историю выдачи расходных материалов"""
    q = db.query(ConsumableIssue)

    if consumable_id:
        q = q.filter(ConsumableIssue.consumable_id == consumable_id)

    if issued_to_id:
        q = q.filter(ConsumableIssue.issued_to_id == issued_to_id)

    q = q.order_by(ConsumableIssue.created_at.desc())
    offset = (page - 1) * page_size
    issues = q.offset(offset).limit(page_size).all()

    # Формируем ответ с дополнительной информацией
    result = []
    for issue in issues:
        issue_dict = {
            "id": issue.id,
            "consumable_id": issue.consumable_id,
            "quantity": issue.quantity,
            "issued_to_id": issue.issued_to_id,
            "issued_by_id": issue.issued_by_id,
            "reason": issue.reason,
            "created_at": issue.created_at,
        }

        # Добавляем информацию о расходнике
        if issue.consumable:
            issue_dict["consumable_name"] = issue.consumable.name
            issue_dict["consumable_unit"] = issue.consumable.unit

        # Добавляем информацию о пользователях
        if issue.issued_to:
            issue_dict["issued_to_name"] = issue.issued_to.full_name

        if issue.issued_by:
            issue_dict["issued_by_name"] = issue.issued_by.full_name

        result.append(ConsumableIssueOut(**issue_dict))

    return result


@router.post(
    "/issues/",
    response_model=ConsumableIssueOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_consumable_issue(
    payload: ConsumableIssueCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConsumableIssueOut:
    """Выдать расходный материал"""
    # Проверяем существование расходника
    consumable = (
        db.query(Consumable).filter(Consumable.id == payload.consumable_id).first()
    )
    if not consumable:
        raise HTTPException(status_code=404, detail="Расходный материал не найден")

    # Проверяем наличие достаточного количества
    if consumable.quantity_in_stock < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно расходного материала. В наличии: {consumable.quantity_in_stock} {consumable.unit}",
        )

    # Создаем запись о выдаче
    issue = ConsumableIssue(
        consumable_id=payload.consumable_id,
        quantity=payload.quantity,
        issued_to_id=payload.issued_to_id,
        issued_by_id=user.id,
        reason=payload.reason,
    )
    db.add(issue)

    # Уменьшаем количество на складе
    consumable.quantity_in_stock -= payload.quantity
    db.commit()
    db.refresh(issue)
    db.refresh(consumable)

    # Формируем ответ
    issue_dict = {
        "id": issue.id,
        "consumable_id": issue.consumable_id,
        "quantity": issue.quantity,
        "issued_to_id": issue.issued_to_id,
        "issued_by_id": issue.issued_by_id,
        "reason": issue.reason,
        "created_at": issue.created_at,
        "consumable_name": consumable.name,
        "consumable_unit": consumable.unit,
    }

    if issue.issued_to:
        issue_dict["issued_to_name"] = issue.issued_to.full_name

    if issue.issued_by:
        issue_dict["issued_by_name"] = issue.issued_by.full_name

    return ConsumableIssueOut(**issue_dict)


# =====================
# ПОСТАВКИ РАСХОДНИКОВ
# =====================


@router.get("/supplies/", response_model=List[ConsumableSupplyOut])
def list_consumable_supplies(
    db: Session = Depends(get_db),
    consumable_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> List[ConsumableSupplyOut]:
    """Получить историю поставок расходных материалов"""
    q = db.query(ConsumableSupply)

    if consumable_id:
        q = q.filter(ConsumableSupply.consumable_id == consumable_id)

    q = q.order_by(ConsumableSupply.created_at.desc())
    offset = (page - 1) * page_size
    supplies = q.offset(offset).limit(page_size).all()

    # Формируем ответ с дополнительной информацией
    result = []
    for supply in supplies:
        supply_dict = {
            "id": supply.id,
            "consumable_id": supply.consumable_id,
            "quantity": supply.quantity,
            "cost": supply.cost,
            "supplier": supply.supplier,
            "invoice_number": supply.invoice_number,
            "supply_date": supply.supply_date,
            "notes": supply.notes,
            "created_by_id": supply.created_by_id,
            "created_at": supply.created_at,
        }

        # Добавляем информацию о расходнике
        if supply.consumable:
            supply_dict["consumable_name"] = supply.consumable.name
            supply_dict["consumable_unit"] = supply.consumable.unit

        # Добавляем информацию о пользователе, который добавил поставку
        if supply.created_by:
            supply_dict["created_by_name"] = supply.created_by.full_name

        result.append(ConsumableSupplyOut(**supply_dict))

    return result


@router.post(
    "/supplies/",
    response_model=ConsumableSupplyOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_consumable_supply(
    payload: ConsumableSupplyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConsumableSupplyOut:
    """Добавить поставку расходного материала"""
    # Проверяем существование расходника
    consumable = (
        db.query(Consumable).filter(Consumable.id == payload.consumable_id).first()
    )
    if not consumable:
        raise HTTPException(status_code=404, detail="Расходный материал не найден")

    # Создаем запись о поставке
    supply = ConsumableSupply(
        consumable_id=payload.consumable_id,
        quantity=payload.quantity,
        cost=payload.cost,
        supplier=payload.supplier,
        invoice_number=payload.invoice_number,
        supply_date=payload.supply_date,
        notes=payload.notes,
        created_by_id=user.id,
    )
    db.add(supply)

    # Увеличиваем количество на складе
    consumable.quantity_in_stock += payload.quantity

    # Обновляем информацию о поставщике и дате поставки
    if payload.supplier:
        consumable.supplier = payload.supplier
    if payload.supply_date:
        consumable.last_purchase_date = payload.supply_date

    db.commit()
    db.refresh(supply)
    db.refresh(consumable)

    # Формируем ответ
    supply_dict = {
        "id": supply.id,
        "consumable_id": supply.consumable_id,
        "quantity": supply.quantity,
        "cost": supply.cost,
        "supplier": supply.supplier,
        "invoice_number": supply.invoice_number,
        "supply_date": supply.supply_date,
        "notes": supply.notes,
        "created_by_id": supply.created_by_id,
        "created_at": supply.created_at,
        "consumable_name": consumable.name,
        "consumable_unit": consumable.unit,
    }

    if supply.created_by:
        supply_dict["created_by_name"] = supply.created_by.full_name

    return ConsumableSupplyOut(**supply_dict)
