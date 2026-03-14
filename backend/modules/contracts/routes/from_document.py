"""
Создание договора из согласованного документа (кнопка «Отправить в договора»).
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from backend.modules.contracts.dependencies import get_db, get_current_user
from backend.modules.contracts.models import Contract
from backend.modules.contracts.schemas.contract import ContractDetailOut
from backend.modules.documents.models import ApprovalInstance, Document
from backend.modules.hr.models.user import User

router = APIRouter(tags=["contracts-from-document"])


class SendToContractsBody(BaseModel):
    number: str | None = None
    contract_type_id: UUID | None = None
    counterparty_id: UUID | None = None


@router.post("/from-document/{document_id}", response_model=ContractDetailOut, status_code=201)
def create_contract_from_document(
    document_id: UUID,
    body: SendToContractsBody = Body(default_factory=SendToContractsBody),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Создать договор из согласованного документа.
    Доступно только для документов со статусом согласования «завершён».
    """
    doc = (
        db.query(Document)
        .options(joinedload(Document.document_type))
        .filter(Document.id == document_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")

    instance = (
        db.query(ApprovalInstance)
        .filter(ApprovalInstance.document_id == document_id)
        .order_by(ApprovalInstance.attempt.desc())
        .first()
    )
    if not instance or instance.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Документ ещё не согласован. Отправить в договора можно только после завершения согласования.",
        )

    existing = db.query(Contract).filter(Contract.document_id == document_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="По этому документу уже создан договор.",
        )

    contract = Contract(
        document_id=doc.id,
        contract_type_id=body.contract_type_id,
        counterparty_id=body.counterparty_id,
        number=(body.number and body.number.strip()) or (doc.title[:100] if doc.title else "Без номера"),
        name=doc.title,
        full_name=doc.description or doc.title,
        sum_amount=0,
        created_by_id=current_user.id,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    from backend.modules.contracts.routes.contracts import _get_detail

    return _get_detail(contract.id, db)


@router.get("/from-document/{document_id}/contract", response_model=ContractDetailOut)
def get_contract_by_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить договор, созданный по документу (для проверки кнопки «Отправить в договора»)."""
    from backend.modules.contracts.routes.contracts import _get_detail

    contract = db.query(Contract).filter(Contract.document_id == document_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="По этому документу договор не создан")
    return _get_detail(contract.id, db)
