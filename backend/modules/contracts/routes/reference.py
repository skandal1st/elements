"""Роуты справочников: Funding, CostCode, Subunit."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.modules.contracts.dependencies import (
    get_db,
    get_current_user,
    require_contracts_roles,
)
from backend.modules.contracts.models import CostCode, Funding, Subunit
from backend.modules.contracts.schemas.reference import (
    CostCodeCreate,
    CostCodeOut,
    FundingCreate,
    FundingOut,
    SubunitCreate,
    SubunitOut,
)
from backend.modules.hr.models.user import User

router = APIRouter(tags=["contracts-reference"])


# ---------- Funding ----------
@router.get("/funding", response_model=List[FundingOut])
def list_funding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: bool | None = Query(None),
):
    q = db.query(Funding).order_by(Funding.name)
    if is_active is not None:
        q = q.filter(Funding.is_active == is_active)
    return q.all()


@router.post("/funding", response_model=FundingOut, status_code=201)
def create_funding(
    payload: FundingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    f = Funding(name=payload.name.strip(), is_active=payload.is_active)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@router.patch("/funding/{item_id}", response_model=FundingOut)
def update_funding(
    item_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    f = db.query(Funding).filter(Funding.id == item_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Не найдено")
    if "name" in payload:
        f.name = str(payload["name"]).strip()
    if "is_active" in payload:
        f.is_active = bool(payload["is_active"])
    db.commit()
    db.refresh(f)
    return f


@router.delete("/funding/{item_id}", status_code=204)
def delete_funding(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin"])),
):
    f = db.query(Funding).filter(Funding.id == item_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Не найдено")
    db.delete(f)
    db.commit()


# ---------- CostCode ----------
@router.get("/cost-codes", response_model=List[CostCodeOut])
def list_cost_codes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: bool | None = Query(None),
):
    q = db.query(CostCode).order_by(CostCode.name)
    if is_active is not None:
        q = q.filter(CostCode.is_active == is_active)
    return q.all()


@router.post("/cost-codes", response_model=CostCodeOut, status_code=201)
def create_cost_code(
    payload: CostCodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    c = CostCode(name=payload.name.strip(), is_active=payload.is_active)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.patch("/cost-codes/{item_id}", response_model=CostCodeOut)
def update_cost_code(
    item_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    c = db.query(CostCode).filter(CostCode.id == item_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Не найдено")
    if "name" in payload:
        c.name = str(payload["name"]).strip()
    if "is_active" in payload:
        c.is_active = bool(payload["is_active"])
    db.commit()
    db.refresh(c)
    return c


@router.delete("/cost-codes/{item_id}", status_code=204)
def delete_cost_code(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin"])),
):
    c = db.query(CostCode).filter(CostCode.id == item_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Не найдено")
    db.delete(c)
    db.commit()


# ---------- Subunit ----------
@router.get("/subunits", response_model=List[SubunitOut])
def list_subunits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: bool | None = Query(None),
):
    q = db.query(Subunit).order_by(Subunit.name)
    if is_active is not None:
        q = q.filter(Subunit.is_active == is_active)
    return q.all()


@router.post("/subunits", response_model=SubunitOut, status_code=201)
def create_subunit(
    payload: SubunitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    s = Subunit(name=payload.name.strip(), is_active=payload.is_active)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.patch("/subunits/{item_id}", response_model=SubunitOut)
def update_subunit(
    item_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    s = db.query(Subunit).filter(Subunit.id == item_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Не найдено")
    if "name" in payload:
        s.name = str(payload["name"]).strip()
    if "is_active" in payload:
        s.is_active = bool(payload["is_active"])
    db.commit()
    db.refresh(s)
    return s


@router.delete("/subunits/{item_id}", status_code=204)
def delete_subunit(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin"])),
):
    s = db.query(Subunit).filter(Subunit.id == item_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Не найдено")
    db.delete(s)
    db.commit()
