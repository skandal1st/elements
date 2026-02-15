"""Роуты согласования документов."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.modules.documents.dependencies import get_db, get_current_user
from backend.modules.documents.models import (
    ApprovalInstance,
    ApprovalStepInstance,
    Document,
)
from backend.modules.documents.schemas.approval import (
    ApprovalDecisionRequest,
    ApprovalInstanceOut,
    ApprovalStepInstanceOut,
    MyApprovalItem,
    SubmitRequest,
)
from backend.modules.documents.services.approval_engine import (
    cancel_document,
    process_decision,
    resubmit_for_approval,
    submit_for_approval,
)
from backend.modules.hr.models.user import User

router = APIRouter(tags=["document-approvals"])


def _enrich_step_instances(steps: list, db: Session) -> list:
    """Добавляет имя согласующего к шагам."""
    result = []
    for s in steps:
        data = {c.name: getattr(s, c.name) for c in s.__table__.columns}
        user = db.query(User).filter(User.id == s.approver_id).first()
        data["approver_name"] = user.full_name if user else None
        result.append(data)
    return result


@router.post("/{document_id}/submit", response_model=ApprovalInstanceOut)
def submit_document(
    document_id: UUID,
    payload: SubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if doc.creator_id != current_user.id and not current_user.is_superuser and current_user.get_role("documents") != "admin":
        raise HTTPException(status_code=403, detail="Только создатель может отправить на согласование")

    try:
        if doc.status == "rejected":
            instance = resubmit_for_approval(db, doc)
        else:
            instance = submit_for_approval(db, doc, route_id=payload.route_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Уведомления первым согласующим
    _notify_approvers(db, instance)

    data = {c.name: getattr(instance, c.name) for c in instance.__table__.columns}
    data["step_instances"] = _enrich_step_instances(instance.step_instances, db)
    return data


@router.post("/{document_id}/approve", response_model=ApprovalInstanceOut)
def approve_document(
    document_id: UUID,
    payload: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    try:
        instance = process_decision(db, doc, current_user.id, "approved", payload.comment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Уведомления
    if instance.status == "approved":
        _notify_document_approved(db, doc)
    else:
        _notify_approvers(db, instance)

    data = {c.name: getattr(instance, c.name) for c in instance.__table__.columns}
    data["step_instances"] = _enrich_step_instances(instance.step_instances, db)
    return data


@router.post("/{document_id}/reject", response_model=ApprovalInstanceOut)
def reject_document(
    document_id: UUID,
    payload: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    try:
        instance = process_decision(db, doc, current_user.id, "rejected", payload.comment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    _notify_document_rejected(db, doc)

    data = {c.name: getattr(instance, c.name) for c in instance.__table__.columns}
    data["step_instances"] = _enrich_step_instances(instance.step_instances, db)
    return data


@router.post("/{document_id}/cancel")
def cancel_doc(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if doc.creator_id != current_user.id and not current_user.is_superuser and current_user.get_role("documents") != "admin":
        raise HTTPException(status_code=403, detail="Только создатель может отменить документ")
    try:
        cancel_document(db, doc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Документ отменён"}


@router.get("/{document_id}/approval", response_model=List[ApprovalInstanceOut])
def get_approval_status(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    instances = (
        db.query(ApprovalInstance)
        .options(joinedload(ApprovalInstance.step_instances))
        .filter(ApprovalInstance.document_id == document_id)
        .order_by(ApprovalInstance.attempt.desc())
        .all()
    )
    result = []
    for inst in instances:
        data = {c.name: getattr(inst, c.name) for c in inst.__table__.columns}
        data["step_instances"] = _enrich_step_instances(inst.step_instances, db)
        result.append(data)
    return result


@router.get("/my-approvals", response_model=List[MyApprovalItem])
def my_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Документы, ожидающие согласования текущего пользователя."""
    steps = (
        db.query(ApprovalStepInstance)
        .join(ApprovalInstance)
        .join(Document)
        .filter(
            ApprovalStepInstance.approver_id == current_user.id,
            ApprovalStepInstance.status == "pending",
            ApprovalInstance.status == "in_progress",
            ApprovalStepInstance.step_order == ApprovalInstance.current_step_order,
            Document.status == "pending_approval",
        )
        .all()
    )
    result = []
    for s in steps:
        inst = s.approval_instance
        doc = inst.document
        creator = db.query(User).filter(User.id == doc.creator_id).first()
        result.append({
            "document_id": doc.id,
            "document_title": doc.title,
            "document_status": doc.status,
            "step_instance_id": s.id,
            "step_order": s.step_order,
            "deadline_at": s.deadline_at,
            "document_creator_name": creator.full_name if creator else None,
        })
    return result


# ---------- Notification helpers (best-effort, no crash on error) ----------

def _notify_approvers(db: Session, instance: ApprovalInstance) -> None:
    """Уведомляет согласующих текущего шага."""
    try:
        from backend.modules.it.models import Notification
        doc = instance.document
        current_steps = [
            s for s in instance.step_instances
            if s.step_order == instance.current_step_order and s.status == "pending"
        ]
        for s in current_steps:
            notif = Notification(
                user_id=s.approver_id,
                title="Документ на согласовании",
                message=f'Документ "{doc.title}" ожидает вашего согласования',
                notification_type="info",
                link=f"/documents/view/{doc.id}",
            )
            db.add(notif)
        db.commit()
    except Exception:
        pass


def _notify_document_approved(db: Session, doc: Document) -> None:
    """Уведомляет инициатора о полном согласовании."""
    try:
        from backend.modules.it.models import Notification
        notif = Notification(
            user_id=doc.creator_id,
            title="Документ согласован",
            message=f'Документ "{doc.title}" полностью согласован',
            notification_type="success",
            link=f"/documents/view/{doc.id}",
        )
        db.add(notif)
        db.commit()
    except Exception:
        pass


def _notify_document_rejected(db: Session, doc: Document) -> None:
    """Уведомляет инициатора об отклонении."""
    try:
        from backend.modules.it.models import Notification
        notif = Notification(
            user_id=doc.creator_id,
            title="Документ отклонён",
            message=f'Документ "{doc.title}" был отклонён',
            notification_type="warning",
            link=f"/documents/view/{doc.id}",
        )
        db.add(notif)
        db.commit()
    except Exception:
        pass
