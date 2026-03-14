"""Роуты типов договоров."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.modules.contracts.dependencies import (
    get_db,
    get_current_user,
    require_contracts_roles,
)
from backend.modules.contracts.models import ContractType
from backend.modules.contracts.schemas.contract_type import (
    ContractTypeCreate,
    ContractTypeOut,
    ContractTypeUpdate,
)
from backend.modules.hr.models.user import User

router = APIRouter(prefix="/contract-types", tags=["contracts-types"])


@router.get("/", response_model=List[ContractTypeOut])
def list_contract_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: bool | None = Query(None),
):
    q = db.query(ContractType).order_by(ContractType.name)
    if is_active is not None:
        q = q.filter(ContractType.is_active == is_active)
    return q.all()


@router.post("/", response_model=ContractTypeOut, status_code=201)
def create_contract_type(
    payload: ContractTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Название обязательно")
    existing = db.query(ContractType).filter(ContractType.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Тип договора с таким названием уже существует")
    ct = ContractType(name=name, is_active=payload.is_active)
    db.add(ct)
    db.commit()
    db.refresh(ct)
    return ct


@router.get("/{type_id}", response_model=ContractTypeOut)
def get_contract_type(
    type_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ct = db.query(ContractType).filter(ContractType.id == type_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Тип договора не найден")
    return ct


@router.patch("/{type_id}", response_model=ContractTypeOut)
def update_contract_type(
    type_id: UUID,
    payload: ContractTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    ct = db.query(ContractType).filter(ContractType.id == type_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Тип договора не найден")
    if payload.name is not None:
        n = payload.name.strip()
        if not n:
            raise HTTPException(status_code=400, detail="Название не может быть пустым")
        ct.name = n
    if payload.is_active is not None:
        ct.is_active = payload.is_active
    db.commit()
    db.refresh(ct)
    return ct


@router.delete("/{type_id}", status_code=204)
def delete_contract_type(
    type_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin"])),
):
    ct = db.query(ContractType).filter(ContractType.id == type_id).first()
    if not ct:
        raise HTTPException(status_code=404, detail="Тип договора не найден")
    db.delete(ct)
    db.commit()
