"""Роуты /documents/routes — маршруты согласования."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.documents.dependencies import get_db, get_current_user, require_documents_roles
from backend.modules.documents.models import ApprovalRoute
from backend.modules.documents.schemas.approval_route import (
    ApprovalRouteCreate,
    ApprovalRouteOut,
    ApprovalRouteUpdate,
)
from backend.modules.hr.models.user import User

router = APIRouter(prefix="/routes", tags=["approval-routes"])


@router.get("/", response_model=List[ApprovalRouteOut])
def list_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(ApprovalRoute).filter(ApprovalRoute.is_active == True)
    return q.order_by(ApprovalRoute.name).all()


@router.get("/{route_id}", response_model=ApprovalRouteOut)
def get_route(
    route_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(ApprovalRoute).filter(ApprovalRoute.id == route_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    return r


@router.post("/", response_model=ApprovalRouteOut, status_code=201)
def create_route(
    payload: ApprovalRouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin"])),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Название маршрута обязательно")
    route = ApprovalRoute(
        name=name,
        description=(payload.description or "").strip() or None,
        steps=[s.model_dump() for s in payload.steps],
        is_active=True,
        created_by=current_user.id,
    )
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


@router.put("/{route_id}", response_model=ApprovalRouteOut)
def update_route(
    route_id: UUID,
    payload: ApprovalRouteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin"])),
):
    r = db.query(ApprovalRoute).filter(ApprovalRoute.id == route_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    if payload.name is not None:
        n = payload.name.strip()
        if not n:
            raise HTTPException(status_code=400, detail="Название не может быть пустым")
        r.name = n
    if payload.description is not None:
        r.description = payload.description.strip() or None
    if payload.steps is not None:
        r.steps = [s.model_dump() for s in payload.steps]
    if payload.is_active is not None:
        r.is_active = payload.is_active
    db.commit()
    db.refresh(r)
    return r


@router.delete("/{route_id}", status_code=200)
def delete_route(
    route_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin"])),
):
    r = db.query(ApprovalRoute).filter(ApprovalRoute.id == route_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    r.is_active = False
    db.commit()
    return {"message": "Маршрут деактивирован"}
