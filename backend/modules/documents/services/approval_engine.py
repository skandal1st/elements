"""Движок согласования — state machine для документов."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from backend.modules.documents.models import (
    ApprovalInstance,
    ApprovalRoute,
    ApprovalStepInstance,
    Document,
)


def submit_for_approval(
    db: Session,
    document: Document,
    route_id: Optional[UUID] = None,
) -> ApprovalInstance:
    """Отправляет документ на согласование."""
    if document.status not in ("draft", "rejected"):
        raise ValueError("Документ должен быть в статусе 'draft' или 'rejected'")

    rid = route_id or document.approval_route_id
    if not rid:
        raise ValueError("Не указан маршрут согласования")

    route = db.query(ApprovalRoute).filter(ApprovalRoute.id == rid).first()
    if not route:
        raise ValueError("Маршрут согласования не найден")
    if not route.steps:
        raise ValueError("Маршрут не содержит шагов")

    document.approval_route_id = rid

    # Определяем номер попытки
    last_instance = (
        db.query(ApprovalInstance)
        .filter(ApprovalInstance.document_id == document.id)
        .order_by(ApprovalInstance.attempt.desc())
        .first()
    )
    attempt = (last_instance.attempt + 1) if last_instance else 1

    instance = ApprovalInstance(
        document_id=document.id,
        route_id=route.id,
        route_snapshot=route.steps,
        status="in_progress",
        current_step_order=1,
        attempt=attempt,
    )
    db.add(instance)
    db.flush()

    # Создаём step instances для всех шагов
    now = datetime.now(timezone.utc)
    for step in route.steps:
        order = step["order"]
        approvers = step.get("approvers", [])
        deadline_hours = step.get("deadline_hours", 48)

        for approver in approvers:
            deadline_at = None
            if order == 1:
                deadline_at = now + timedelta(hours=deadline_hours) if deadline_hours else None

            si = ApprovalStepInstance(
                approval_instance_id=instance.id,
                step_order=order,
                approver_id=approver["user_id"],
                status="pending" if order == 1 else "pending",
                deadline_at=deadline_at,
                carry_over=False,
            )
            db.add(si)

    document.status = "pending_approval"
    db.commit()
    db.refresh(instance)
    return instance


def resubmit_for_approval(
    db: Session,
    document: Document,
) -> ApprovalInstance:
    """Повторная отправка отклонённого документа. Перенос ранее согласованных шагов."""
    if document.status != "rejected":
        raise ValueError("Повторная отправка возможна только для отклонённых документов")

    rid = document.approval_route_id
    if not rid:
        raise ValueError("Не указан маршрут согласования")

    route = db.query(ApprovalRoute).filter(ApprovalRoute.id == rid).first()
    if not route or not route.steps:
        raise ValueError("Маршрут не найден или не содержит шагов")

    # Получаем предыдущий экземпляр
    prev_instance = (
        db.query(ApprovalInstance)
        .filter(ApprovalInstance.document_id == document.id)
        .order_by(ApprovalInstance.attempt.desc())
        .first()
    )
    prev_steps = {}
    if prev_instance:
        for si in prev_instance.step_instances:
            key = (si.step_order, str(si.approver_id))
            prev_steps[key] = si.status

    attempt = (prev_instance.attempt + 1) if prev_instance else 1

    instance = ApprovalInstance(
        document_id=document.id,
        route_id=route.id,
        route_snapshot=route.steps,
        status="in_progress",
        current_step_order=1,
        attempt=attempt,
    )
    db.add(instance)
    db.flush()

    now = datetime.now(timezone.utc)
    first_pending_order = None

    for step in route.steps:
        order = step["order"]
        approvers = step.get("approvers", [])
        deadline_hours = step.get("deadline_hours", 48)

        for approver in approvers:
            key = (order, approver["user_id"])
            prev_status = prev_steps.get(key)

            if prev_status == "approved":
                # Перенос согласованного шага
                si = ApprovalStepInstance(
                    approval_instance_id=instance.id,
                    step_order=order,
                    approver_id=approver["user_id"],
                    status="approved",
                    carry_over=True,
                    decision_at=now,
                )
            else:
                if first_pending_order is None:
                    first_pending_order = order
                si = ApprovalStepInstance(
                    approval_instance_id=instance.id,
                    step_order=order,
                    approver_id=approver["user_id"],
                    status="pending",
                    deadline_at=(now + timedelta(hours=deadline_hours)) if order == first_pending_order else None,
                    carry_over=False,
                )
            db.add(si)

    if first_pending_order:
        instance.current_step_order = first_pending_order
    document.status = "pending_approval"
    db.commit()
    db.refresh(instance)
    return instance


def process_decision(
    db: Session,
    document: Document,
    approver_id: UUID,
    decision: str,
    comment: Optional[str] = None,
) -> ApprovalInstance:
    """Обрабатывает решение согласующего (approve/reject)."""
    if document.status != "pending_approval":
        raise ValueError("Документ не находится на согласовании")

    instance = (
        db.query(ApprovalInstance)
        .filter(
            ApprovalInstance.document_id == document.id,
            ApprovalInstance.status == "in_progress",
        )
        .order_by(ApprovalInstance.attempt.desc())
        .first()
    )
    if not instance:
        raise ValueError("Активный экземпляр согласования не найден")

    # Ищем шаг этого согласующего на текущем step_order
    step_instance = (
        db.query(ApprovalStepInstance)
        .filter(
            ApprovalStepInstance.approval_instance_id == instance.id,
            ApprovalStepInstance.approver_id == approver_id,
            ApprovalStepInstance.step_order == instance.current_step_order,
            ApprovalStepInstance.status == "pending",
        )
        .first()
    )
    if not step_instance:
        raise ValueError("Вы не являетесь согласующим на текущем шаге или уже приняли решение")

    now = datetime.now(timezone.utc)
    step_instance.status = decision
    step_instance.decision_at = now
    step_instance.comment = comment

    if decision == "rejected":
        # Отклонение — весь процесс отклонён
        instance.status = "rejected"
        instance.completed_at = now
        document.status = "rejected"
    elif decision == "approved":
        # Проверяем, все ли согласующие на этом шаге приняли решение
        if _is_step_complete(db, instance):
            _advance_to_next_step(db, instance, document)

    db.commit()
    db.refresh(instance)
    return instance


def cancel_document(db: Session, document: Document) -> None:
    """Отменяет документ."""
    if document.status in ("cancelled", "approved"):
        raise ValueError("Невозможно отменить документ в текущем статусе")

    # Отменяем активный экземпляр согласования, если есть
    active = (
        db.query(ApprovalInstance)
        .filter(
            ApprovalInstance.document_id == document.id,
            ApprovalInstance.status == "in_progress",
        )
        .first()
    )
    if active:
        active.status = "rejected"
        active.completed_at = datetime.now(timezone.utc)

    document.status = "cancelled"
    db.commit()


def _is_step_complete(db: Session, instance: ApprovalInstance) -> bool:
    """Проверяет, все ли согласующие текущего шага приняли решение (approved)."""
    current_steps = (
        db.query(ApprovalStepInstance)
        .filter(
            ApprovalStepInstance.approval_instance_id == instance.id,
            ApprovalStepInstance.step_order == instance.current_step_order,
        )
        .all()
    )
    return all(s.status == "approved" for s in current_steps)


def _advance_to_next_step(
    db: Session,
    instance: ApprovalInstance,
    document: Document,
) -> None:
    """Переход к следующему шагу или завершение согласования."""
    steps = instance.route_snapshot or []
    max_order = max((s["order"] for s in steps), default=0)
    next_order = instance.current_step_order + 1

    while next_order <= max_order:
        # Проверяем, есть ли pending шаги на этом order
        next_steps = (
            db.query(ApprovalStepInstance)
            .filter(
                ApprovalStepInstance.approval_instance_id == instance.id,
                ApprovalStepInstance.step_order == next_order,
                ApprovalStepInstance.status == "pending",
            )
            .all()
        )
        if next_steps:
            # Есть несогласованные шаги — активируем
            instance.current_step_order = next_order
            # Установить дедлайны
            step_def = next((s for s in steps if s["order"] == next_order), None)
            deadline_hours = step_def.get("deadline_hours", 48) if step_def else 48
            now = datetime.now(timezone.utc)
            for si in next_steps:
                si.deadline_at = now + timedelta(hours=deadline_hours) if deadline_hours else None
            return
        # Все шаги carry_over или уже approved — идём дальше
        next_order += 1

    # Все шаги пройдены — согласовано
    now = datetime.now(timezone.utc)
    instance.status = "approved"
    instance.completed_at = now
    instance.current_step_order = max_order
    document.status = "approved"
