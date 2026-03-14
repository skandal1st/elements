"""Роуты контрагентов."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.modules.contracts.dependencies import (
    get_db,
    get_current_user,
    require_contracts_roles,
)
from backend.modules.contracts.models import Counterparty
from backend.modules.contracts.schemas.counterparty import (
    CounterpartyCreate,
    CounterpartyOut,
    CounterpartyUpdate,
)
from backend.modules.hr.models.user import User

router = APIRouter(prefix="/counterparties", tags=["contracts-counterparties"])


@router.get("/", response_model=List[CounterpartyOut])
def list_counterparties(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: str | None = Query(None),
    is_active: bool | None = Query(None),
):
    q = db.query(Counterparty).order_by(Counterparty.name)
    if search:
        q = q.filter(
            Counterparty.name.ilike(f"%{search}%")
            | Counterparty.full_name.ilike(f"%{search}%")
            | (Counterparty.inn.isnot(None) & Counterparty.inn.ilike(f"%{search}%"))
        )
    if is_active is not None:
        q = q.filter(Counterparty.is_active == is_active)
    return q.all()


@router.post("/", response_model=CounterpartyOut, status_code=201)
def create_counterparty(
    payload: CounterpartyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    c = Counterparty(
        name=payload.name.strip(),
        full_name=payload.full_name.strip() if payload.full_name else None,
        inn=payload.inn.strip() if payload.inn else None,
        kpp=payload.kpp.strip() if payload.kpp else None,
        address=payload.address.strip() if payload.address else None,
        is_active=payload.is_active,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{counterparty_id}", response_model=CounterpartyOut)
def get_counterparty(
    counterparty_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Counterparty).filter(Counterparty.id == counterparty_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
    return c


@router.patch("/{counterparty_id}", response_model=CounterpartyOut)
def update_counterparty(
    counterparty_id: UUID,
    payload: CounterpartyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    c = db.query(Counterparty).filter(Counterparty.id == counterparty_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
    if payload.name is not None:
        c.name = payload.name.strip()
    if payload.full_name is not None:
        c.full_name = payload.full_name.strip() or None
    if payload.inn is not None:
        c.inn = payload.inn.strip() or None
    if payload.kpp is not None:
        c.kpp = payload.kpp.strip() or None
    if payload.address is not None:
        c.address = payload.address.strip() or None
    if payload.is_active is not None:
        c.is_active = payload.is_active
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{counterparty_id}", status_code=204)
def delete_counterparty(
    counterparty_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin"])),
):
    c = db.query(Counterparty).filter(Counterparty.id == counterparty_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Контрагент не найден")
    db.delete(c)
    db.commit()
