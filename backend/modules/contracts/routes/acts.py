"""Роуты актов и платёжек по договору."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.contracts.dependencies import (
    get_db,
    get_current_user,
    require_contracts_roles,
)
from backend.modules.contracts.models import Contract, ContractAct
from backend.modules.contracts.schemas.act import (
    ContractActCreate,
    ContractActOut,
    ContractActUpdate,
)
from backend.modules.hr.models.user import User

router = APIRouter(prefix="/{contract_id}/acts", tags=["contracts-acts"])


@router.get("/", response_model=List[ContractActOut])
def list_acts(
    contract_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Договор не найден")
    acts = db.query(ContractAct).filter(ContractAct.contract_id == contract_id).order_by(ContractAct.act_date).all()
    return acts


@router.post("/", response_model=ContractActOut, status_code=201)
def create_act(
    contract_id: UUID,
    payload: ContractActCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Договор не найден")
    act = ContractAct(
        contract_id=contract_id,
        doctype=payload.doctype,
        number=payload.number.strip() if payload.number else None,
        act_date=payload.act_date,
        notice=payload.notice.strip() if payload.notice else None,
        amount=payload.amount,
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    return act


@router.get("/{act_id}", response_model=ContractActOut)
def get_act(
    contract_id: UUID,
    act_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    act = (
        db.query(ContractAct)
        .filter(ContractAct.id == act_id, ContractAct.contract_id == contract_id)
        .first()
    )
    if not act:
        raise HTTPException(status_code=404, detail="Акт не найден")
    return act


@router.patch("/{act_id}", response_model=ContractActOut)
def update_act(
    contract_id: UUID,
    act_id: UUID,
    payload: ContractActUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    act = (
        db.query(ContractAct)
        .filter(ContractAct.id == act_id, ContractAct.contract_id == contract_id)
        .first()
    )
    if not act:
        raise HTTPException(status_code=404, detail="Акт не найден")
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(act, k, v)
    db.commit()
    db.refresh(act)
    return act


@router.delete("/{act_id}", status_code=204)
def delete_act(
    contract_id: UUID,
    act_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    act = (
        db.query(ContractAct)
        .filter(ContractAct.id == act_id, ContractAct.contract_id == contract_id)
        .first()
    )
    if not act:
        raise HTTPException(status_code=404, detail="Акт не найден")
    db.delete(act)
    db.commit()
