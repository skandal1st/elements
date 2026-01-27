"""Роуты /it/equipment-requests — заявки на оборудование."""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.it.models import EquipmentRequest
from backend.modules.it.schemas.equipment_request import (
    EquipmentRequestCreate,
    EquipmentRequestOut,
    EquipmentRequestUpdate,
    ReviewRequest,
)
from backend.modules.hr.models.user import User
from backend.modules.hr.models.employee import Employee


router = APIRouter(prefix="/equipment-requests", tags=["equipment-requests"])


def _user_it_role(user: User) -> str:
    """Определяет роль пользователя в IT модуле"""
    if user.is_superuser:
        return "admin"
    return user.get_role("it") or "employee"


def _requester_department(db: Session, user: User) -> Optional[str]:
    """Подразделение заявителя: User -> Employee -> Department. У User нет department."""
    emp = db.query(Employee).filter(Employee.user_id == user.id).first()
    if emp and emp.department:
        return emp.department.name
    return None


@router.get("/", response_model=List[EquipmentRequestOut])
def list_equipment_requests(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    request_type: Optional[str] = Query(None),
    requester_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> List[EquipmentRequestOut]:
    """Получить список заявок на оборудование"""
    role = _user_it_role(user)
    
    q = db.query(EquipmentRequest)
    
    # Employee видит только свои заявки
    if role == "employee":
        q = q.filter(EquipmentRequest.requester_id == user.id)
    elif requester_id:
        q = q.filter(EquipmentRequest.requester_id == requester_id)
    
    if status:
        q = q.filter(EquipmentRequest.status == status)
    if urgency:
        q = q.filter(EquipmentRequest.urgency == urgency)
    if category:
        q = q.filter(EquipmentRequest.equipment_category == category)
    if request_type:
        q = q.filter(EquipmentRequest.request_type == request_type)
    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.filter(
            or_(
                EquipmentRequest.title.ilike(s),
                EquipmentRequest.description.ilike(s),
            )
        )
    
    q = q.order_by(EquipmentRequest.created_at.desc())
    offset = (page - 1) * page_size
    requests = q.offset(offset).limit(page_size).all()
    
    # Формируем ответ с дополнительной информацией
    result = []
    for req in requests:
        req_dict = {
            "id": req.id,
            "title": req.title,
            "description": req.description,
            "equipment_category": req.equipment_category,
            "request_type": req.request_type,
            "quantity": req.quantity,
            "urgency": req.urgency,
            "justification": req.justification,
            "status": req.status,
            "requester_id": req.requester_id,
            "reviewer_id": req.reviewer_id,
            "replace_equipment_id": req.replace_equipment_id,
            "issued_equipment_id": req.issued_equipment_id,
            "estimated_cost": req.estimated_cost,
            "review_comment": req.review_comment,
            "reviewed_at": req.reviewed_at,
            "ordered_at": req.ordered_at,
            "received_at": req.received_at,
            "issued_at": req.issued_at,
            "created_at": req.created_at,
            "updated_at": req.updated_at,
        }
        
        # Добавляем информацию о пользователях
        if req.requester:
            req_dict["requester_name"] = req.requester.full_name
            req_dict["requester_email"] = req.requester.email
            req_dict["requester_department"] = _requester_department(db, req.requester)
        
        if req.reviewer:
            req_dict["reviewer_name"] = req.reviewer.full_name
        
        # Добавляем информацию об оборудовании
        if req.replace_equipment:
            req_dict["replace_equipment_name"] = req.replace_equipment.name
            req_dict["replace_equipment_inventory"] = req.replace_equipment.inventory_number
        
        if req.issued_equipment:
            req_dict["issued_equipment_name"] = req.issued_equipment.name
            req_dict["issued_equipment_inventory"] = req.issued_equipment.inventory_number
        
        result.append(EquipmentRequestOut(**req_dict))
    
    return result


@router.get("/{request_id}", response_model=EquipmentRequestOut)
def get_equipment_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EquipmentRequestOut:
    """Получить заявку по ID"""
    req = db.query(EquipmentRequest).filter(EquipmentRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    role = _user_it_role(user)
    if role == "employee" and req.requester_id != user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    # Формируем ответ (аналогично list_equipment_requests)
    req_dict = {
        "id": req.id,
        "title": req.title,
        "description": req.description,
        "equipment_category": req.equipment_category,
        "request_type": req.request_type,
        "quantity": req.quantity,
        "urgency": req.urgency,
        "justification": req.justification,
        "status": req.status,
        "requester_id": req.requester_id,
        "reviewer_id": req.reviewer_id,
        "replace_equipment_id": req.replace_equipment_id,
        "issued_equipment_id": req.issued_equipment_id,
        "estimated_cost": req.estimated_cost,
        "review_comment": req.review_comment,
        "reviewed_at": req.reviewed_at,
        "ordered_at": req.ordered_at,
        "received_at": req.received_at,
        "issued_at": req.issued_at,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
    }
    
    if req.requester:
        req_dict["requester_name"] = req.requester.full_name
        req_dict["requester_email"] = req.requester.email
        req_dict["requester_department"] = _requester_department(db, req.requester)
    
    if req.reviewer:
        req_dict["reviewer_name"] = req.reviewer.full_name
    
    if req.replace_equipment:
        req_dict["replace_equipment_name"] = req.replace_equipment.name
        req_dict["replace_equipment_inventory"] = req.replace_equipment.inventory_number
    
    if req.issued_equipment:
        req_dict["issued_equipment_name"] = req.issued_equipment.name
        req_dict["issued_equipment_inventory"] = req.issued_equipment.inventory_number
    
    return EquipmentRequestOut(**req_dict)


@router.post("/", response_model=EquipmentRequestOut, status_code=201)
def create_equipment_request(
    payload: EquipmentRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EquipmentRequestOut:
    """Создать заявку на оборудование"""
    data = payload.model_dump()
    data["requester_id"] = user.id
    req = EquipmentRequest(**data)
    db.add(req)
    db.commit()
    db.refresh(req)
    
    # Формируем ответ
    req_dict = {
        "id": req.id,
        "title": req.title,
        "description": req.description,
        "equipment_category": req.equipment_category,
        "request_type": req.request_type,
        "quantity": req.quantity,
        "urgency": req.urgency,
        "justification": req.justification,
        "status": req.status,
        "requester_id": req.requester_id,
        "reviewer_id": req.reviewer_id,
        "replace_equipment_id": req.replace_equipment_id,
        "issued_equipment_id": req.issued_equipment_id,
        "estimated_cost": req.estimated_cost,
        "review_comment": req.review_comment,
        "reviewed_at": req.reviewed_at,
        "ordered_at": req.ordered_at,
        "received_at": req.received_at,
        "issued_at": req.issued_at,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
        "requester_name": user.full_name,
        "requester_email": user.email,
        "requester_department": _requester_department(db, user),
    }
    
    return EquipmentRequestOut(**req_dict)


@router.patch("/{request_id}", response_model=EquipmentRequestOut)
def update_equipment_request(
    request_id: UUID,
    payload: EquipmentRequestUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EquipmentRequestOut:
    """Обновить заявку на оборудование"""
    req = db.query(EquipmentRequest).filter(EquipmentRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    role = _user_it_role(user)
    
    # Проверка прав: employee может редактировать только свои pending заявки
    if role == "employee":
        if req.requester_id != user.id:
            raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
        if req.status != "pending":
            raise HTTPException(status_code=400, detail="Нельзя редактировать заявку в этом статусе")
    
    old_status = req.status
    update_data = payload.model_dump(exclude_unset=True)
    
    # Только IT/Admin могут менять статус и связанные поля
    if role not in ("admin", "it_specialist"):
        update_data.pop("status", None)
        update_data.pop("issued_equipment_id", None)
        update_data.pop("ordered_at", None)
        update_data.pop("received_at", None)
        update_data.pop("issued_at", None)
    
    for k, v in update_data.items():
        setattr(req, k, v)
    
    db.commit()
    db.refresh(req)

    # Email уведомление заявителю о смене статуса
    if req.requester and req.requester.email and req.status != old_status:
        try:
            from backend.modules.it.services.email_service import email_service

            await email_service.send_equipment_request_status_notification(
                db=db,
                to_email=req.requester.email,
                request_id=str(req.id),
                title=req.title,
                new_status=req.status,
            )
        except Exception:
            # Не блокируем изменение заявки из-за email
            pass
    
    # Формируем ответ (аналогично get_equipment_request)
    req_dict = {
        "id": req.id,
        "title": req.title,
        "description": req.description,
        "equipment_category": req.equipment_category,
        "request_type": req.request_type,
        "quantity": req.quantity,
        "urgency": req.urgency,
        "justification": req.justification,
        "status": req.status,
        "requester_id": req.requester_id,
        "reviewer_id": req.reviewer_id,
        "replace_equipment_id": req.replace_equipment_id,
        "issued_equipment_id": req.issued_equipment_id,
        "estimated_cost": req.estimated_cost,
        "review_comment": req.review_comment,
        "reviewed_at": req.reviewed_at,
        "ordered_at": req.ordered_at,
        "received_at": req.received_at,
        "issued_at": req.issued_at,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
    }
    
    if req.requester:
        req_dict["requester_name"] = req.requester.full_name
        req_dict["requester_email"] = req.requester.email
        req_dict["requester_department"] = _requester_department(db, req.requester)
    
    if req.reviewer:
        req_dict["reviewer_name"] = req.reviewer.full_name
    
    if req.replace_equipment:
        req_dict["replace_equipment_name"] = req.replace_equipment.name
        req_dict["replace_equipment_inventory"] = req.replace_equipment.inventory_number
    
    if req.issued_equipment:
        req_dict["issued_equipment_name"] = req.issued_equipment.name
        req_dict["issued_equipment_inventory"] = req.issued_equipment.inventory_number
    
    return EquipmentRequestOut(**req_dict)


@router.post("/{request_id}/review", response_model=EquipmentRequestOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def review_equipment_request(
    request_id: UUID,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EquipmentRequestOut:
    """Одобрить/отклонить заявку"""
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Некорректный статус. Допустимые: approved, rejected")
    
    req = db.query(EquipmentRequest).filter(EquipmentRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Можно рассматривать только заявки в статусе pending")
    
    req.status = payload.status
    req.reviewer_id = user.id
    req.review_comment = payload.comment
    req.reviewed_at = datetime.now(timezone.utc)
    if payload.estimated_cost is not None:
        req.estimated_cost = payload.estimated_cost
    
    db.commit()
    db.refresh(req)

    # Email уведомление заявителю
    if req.requester and req.requester.email:
        try:
            from backend.modules.it.services.email_service import email_service

            # статус изменился гарантированно (pending -> approved/rejected)
            await email_service.send_equipment_request_status_notification(
                db=db,
                to_email=req.requester.email,
                request_id=str(req.id),
                title=req.title,
                new_status=req.status,
            )
        except Exception:
            pass
    
    # Формируем ответ
    req_dict = {
        "id": req.id,
        "title": req.title,
        "description": req.description,
        "equipment_category": req.equipment_category,
        "request_type": req.request_type,
        "quantity": req.quantity,
        "urgency": req.urgency,
        "justification": req.justification,
        "status": req.status,
        "requester_id": req.requester_id,
        "reviewer_id": req.reviewer_id,
        "replace_equipment_id": req.replace_equipment_id,
        "issued_equipment_id": req.issued_equipment_id,
        "estimated_cost": req.estimated_cost,
        "review_comment": req.review_comment,
        "reviewed_at": req.reviewed_at,
        "ordered_at": req.ordered_at,
        "received_at": req.received_at,
        "issued_at": req.issued_at,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
        "reviewer_name": user.full_name,
    }
    
    if req.requester:
        req_dict["requester_name"] = req.requester.full_name
        req_dict["requester_email"] = req.requester.email
        req_dict["requester_department"] = _requester_department(db, req.requester)
    
    return EquipmentRequestOut(**req_dict)


@router.post("/{request_id}/cancel", response_model=EquipmentRequestOut)
def cancel_equipment_request(
    request_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EquipmentRequestOut:
    """Отменить заявку (только автор или admin)"""
    req = db.query(EquipmentRequest).filter(EquipmentRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    role = _user_it_role(user)
    if req.requester_id != user.id and role != "admin":
        raise HTTPException(status_code=403, detail="Можно отменить только свою заявку")
    
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Можно отменить только заявку в статусе pending")
    
    req.status = "cancelled"
    db.commit()
    db.refresh(req)

    # Email уведомление заявителю
    if req.requester and req.requester.email:
        try:
            from backend.modules.it.services.email_service import email_service

            await email_service.send_equipment_request_status_notification(
                db=db,
                to_email=req.requester.email,
                request_id=str(req.id),
                title=req.title,
                new_status=req.status,
            )
        except Exception:
            pass
    
    # Формируем ответ (аналогично update_equipment_request)
    req_dict = {
        "id": req.id,
        "title": req.title,
        "description": req.description,
        "equipment_category": req.equipment_category,
        "request_type": req.request_type,
        "quantity": req.quantity,
        "urgency": req.urgency,
        "justification": req.justification,
        "status": req.status,
        "requester_id": req.requester_id,
        "reviewer_id": req.reviewer_id,
        "replace_equipment_id": req.replace_equipment_id,
        "issued_equipment_id": req.issued_equipment_id,
        "estimated_cost": req.estimated_cost,
        "review_comment": req.review_comment,
        "reviewed_at": req.reviewed_at,
        "ordered_at": req.ordered_at,
        "received_at": req.received_at,
        "issued_at": req.issued_at,
        "created_at": req.created_at,
        "updated_at": req.updated_at,
    }
    
    if req.requester:
        req_dict["requester_name"] = req.requester.full_name
        req_dict["requester_email"] = req.requester.email
        req_dict["requester_department"] = _requester_department(db, req.requester)
    
    if req.reviewer:
        req_dict["reviewer_name"] = req.reviewer.full_name
    
    return EquipmentRequestOut(**req_dict)


@router.delete("/{request_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin"]))])
def delete_equipment_request(
    request_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить заявку (только admin)"""
    req = db.query(EquipmentRequest).filter(EquipmentRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    
    db.delete(req)
    db.commit()
    return {"message": "Заявка удалена"}
