"""Роуты договоров (список с фильтрами и агрегатами, CRUD)."""
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from backend.modules.contracts.dependencies import (
    get_db,
    get_current_user,
    require_contracts_roles,
)
from backend.modules.contracts.models import Contract, ContractAct
from backend.modules.contracts.schemas.contract import (
    ContractCreate,
    ContractDetailOut,
    ContractListOut,
    ContractUpdate,
)
from backend.modules.hr.models.user import User

router = APIRouter(tags=["contracts"])


def _contract_aggregates(contract: Contract) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    """Суммы по актам (doctype=0), по П/П (doctype=1), остатки."""
    sum_acts = Decimal("0")
    sum_pp = Decimal("0")
    for a in contract.acts:
        if a.doctype == 0:
            sum_acts += a.amount
        elif a.doctype == 1:
            sum_pp += a.amount
    rest_acts = contract.sum_amount - sum_acts
    rest_pp = contract.sum_amount - sum_pp
    return sum_acts, sum_pp, rest_acts, rest_pp


def _to_list_out(contract: Contract) -> ContractListOut:
    sum_acts, sum_pp, rest_acts, rest_pp = _contract_aggregates(contract)
    return ContractListOut(
        id=contract.id,
        document_id=contract.document_id,
        legacy_num=contract.legacy_num,
        contract_type_id=contract.contract_type_id,
        counterparty_id=contract.counterparty_id,
        number=contract.number,
        date_begin=contract.date_begin,
        date_end=contract.date_end,
        name=contract.name,
        sum_amount=contract.sum_amount,
        term=contract.term,
        done=contract.done,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
        sum_acts=sum_acts,
        sum_pp=sum_pp,
        rest_acts=rest_acts,
        rest_pp=rest_pp,
        counterparty_name=contract.counterparty.name if contract.counterparty else None,
        contract_type_name=contract.contract_type.name if contract.contract_type else None,
        funding_name=contract.funding.name if contract.funding else None,
        subunit_name=contract.subunit.name if contract.subunit else None,
    )


@router.get("/", response_model=List[ContractListOut])
def list_contracts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    number: Optional[str] = Query(None),
    date_begin_from: Optional[date] = Query(None),
    date_begin_to: Optional[date] = Query(None),
    counterparty_id: Optional[UUID] = Query(None),
    contract_type_id: Optional[UUID] = Query(None),
    funding_id: Optional[UUID] = Query(None),
    subunit_id: Optional[UUID] = Query(None),
    order_by: str = Query("date_begin", description="date_begin | updated_at"),
):
    q = (
        db.query(Contract)
        .options(
            joinedload(Contract.counterparty),
            joinedload(Contract.contract_type),
            joinedload(Contract.funding),
            joinedload(Contract.subunit),
            joinedload(Contract.acts),
        )
        .order_by(
            Contract.updated_at.desc() if order_by == "updated_at" else Contract.date_begin.desc()
        )
    )
    if number:
        q = q.filter(Contract.number.ilike(f"%{number}%"))
    if date_begin_from:
        q = q.filter(Contract.date_begin >= date_begin_from)
    if date_begin_to:
        q = q.filter(Contract.date_begin <= date_begin_to)
    if counterparty_id:
        q = q.filter(Contract.counterparty_id == counterparty_id)
    if contract_type_id:
        q = q.filter(Contract.contract_type_id == contract_type_id)
    if funding_id:
        q = q.filter(Contract.funding_id == funding_id)
    if subunit_id:
        q = q.filter(Contract.subunit_id == subunit_id)
    contracts = q.all()
    return [_to_list_out(c) for c in contracts]


@router.post("/", response_model=ContractDetailOut, status_code=201)
def create_contract(
    payload: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    contract = Contract(
        document_id=payload.document_id,
        contract_type_id=payload.contract_type_id,
        counterparty_id=payload.counterparty_id,
        funding_id=payload.funding_id,
        cost_code_id=payload.cost_code_id,
        subunit_id=payload.subunit_id,
        number=payload.number.strip(),
        date_begin=payload.date_begin,
        date_end=payload.date_end,
        name=payload.name.strip(),
        full_name=payload.full_name.strip() if payload.full_name else None,
        inv_num=payload.inv_num.strip() if payload.inv_num else None,
        comment=payload.comment.strip() if payload.comment else None,
        sum_amount=payload.sum_amount,
        notice=payload.notice.strip() if payload.notice else None,
        term=payload.term,
        done=payload.done,
        created_by_id=current_user.id,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return _get_detail(contract.id, db)


@router.get("/{contract_id}", response_model=ContractDetailOut)
def get_contract(
    contract_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_detail(contract_id, db)


def _get_detail(contract_id: UUID, db: Session) -> ContractDetailOut:
    contract = (
        db.query(Contract)
        .options(
            joinedload(Contract.counterparty),
            joinedload(Contract.contract_type),
            joinedload(Contract.funding),
            joinedload(Contract.cost_code),
            joinedload(Contract.subunit),
            joinedload(Contract.acts),
            joinedload(Contract.files),
        )
        .filter(Contract.id == contract_id)
        .first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Договор не найден")
    sum_acts, sum_pp, rest_acts, rest_pp = _contract_aggregates(contract)
    return ContractDetailOut(
        id=contract.id,
        document_id=contract.document_id,
        legacy_num=contract.legacy_num,
        contract_type_id=contract.contract_type_id,
        counterparty_id=contract.counterparty_id,
        number=contract.number,
        date_begin=contract.date_begin,
        date_end=contract.date_end,
        name=contract.name,
        full_name=contract.full_name,
        inv_num=contract.inv_num,
        comment=contract.comment,
        sum_amount=contract.sum_amount,
        notice=contract.notice,
        term=contract.term,
        done=contract.done,
        funding_id=contract.funding_id,
        cost_code_id=contract.cost_code_id,
        subunit_id=contract.subunit_id,
        created_by_id=contract.created_by_id,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
        sum_acts=sum_acts,
        sum_pp=sum_pp,
        rest_acts=rest_acts,
        rest_pp=rest_pp,
        counterparty_name=contract.counterparty.name if contract.counterparty else None,
        contract_type_name=contract.contract_type.name if contract.contract_type else None,
        funding_name=contract.funding.name if contract.funding else None,
        subunit_name=contract.subunit.name if contract.subunit else None,
        acts=contract.acts,
        files=contract.files,
    )


@router.patch("/{contract_id}", response_model=ContractDetailOut)
def update_contract(
    contract_id: UUID,
    payload: ContractUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin", "specialist"])),
):
    contract = (
        db.query(Contract)
        .options(
            joinedload(Contract.counterparty),
            joinedload(Contract.contract_type),
            joinedload(Contract.funding),
            joinedload(Contract.cost_code),
            joinedload(Contract.subunit),
            joinedload(Contract.acts),
            joinedload(Contract.files),
        )
        .filter(Contract.id == contract_id)
        .first()
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Договор не найден")
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(contract, k, v)
    if "number" in update_data and update_data["number"]:
        contract.number = update_data["number"].strip()
    if "name" in update_data and update_data["name"]:
        contract.name = update_data["name"].strip()
    db.commit()
    db.refresh(contract)
    return _get_detail(contract.id, db)


@router.delete("/{contract_id}", status_code=204)
def delete_contract(
    contract_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_contracts_roles(["admin"])),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Договор не найден")
    db.delete(contract)
    db.commit()
