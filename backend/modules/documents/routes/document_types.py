"""Роуты /documents/types — типы документов."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.modules.documents.dependencies import get_db, get_current_user, require_documents_roles
from backend.modules.documents.models import DocumentType
from backend.modules.documents.schemas.document_type import (
    DocumentTypeCreate,
    DocumentTypeOut,
    DocumentTypeUpdate,
)
from backend.modules.hr.models.user import User

router = APIRouter(prefix="/types", tags=["document-types"])


@router.get("/", response_model=List[DocumentTypeOut])
def list_document_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active: Optional[bool] = Query(None),
):
    q = db.query(DocumentType).order_by(DocumentType.name)
    if active is True:
        q = q.filter(DocumentType.is_active == True)
    return q.all()


@router.post("/", response_model=DocumentTypeOut, status_code=201)
def create_document_type(
    payload: DocumentTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin"])),
):
    name = (payload.name or "").strip()
    code = (payload.code or "").strip()
    if not name or not code:
        raise HTTPException(status_code=400, detail="Название и код обязательны")
    existing = db.query(DocumentType).filter(
        (DocumentType.name == name) | (DocumentType.code == code)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Тип документа с таким названием или кодом уже существует")
    dt = DocumentType(
        name=name,
        description=(payload.description or "").strip() or None,
        code=code,
        default_route_id=payload.default_route_id,
        is_active=payload.is_active,
    )
    db.add(dt)
    db.commit()
    db.refresh(dt)
    return dt


@router.patch("/{type_id}", response_model=DocumentTypeOut)
def update_document_type(
    type_id: UUID,
    payload: DocumentTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin"])),
):
    dt = db.query(DocumentType).filter(DocumentType.id == type_id).first()
    if not dt:
        raise HTTPException(status_code=404, detail="Тип документа не найден")
    if payload.name is not None:
        n = payload.name.strip()
        if not n:
            raise HTTPException(status_code=400, detail="Название не может быть пустым")
        if n != dt.name:
            ex = db.query(DocumentType).filter(DocumentType.name == n, DocumentType.id != type_id).first()
            if ex:
                raise HTTPException(status_code=400, detail="Тип с таким названием уже существует")
        dt.name = n
    if payload.code is not None:
        c = payload.code.strip()
        if not c:
            raise HTTPException(status_code=400, detail="Код не может быть пустым")
        if c != dt.code:
            ex = db.query(DocumentType).filter(DocumentType.code == c, DocumentType.id != type_id).first()
            if ex:
                raise HTTPException(status_code=400, detail="Тип с таким кодом уже существует")
        dt.code = c
    if payload.description is not None:
        dt.description = payload.description.strip() or None
    if payload.default_route_id is not None:
        dt.default_route_id = payload.default_route_id
    if payload.is_active is not None:
        dt.is_active = payload.is_active
    db.commit()
    db.refresh(dt)
    return dt


@router.delete("/{type_id}", status_code=200)
def delete_document_type(
    type_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin"])),
):
    dt = db.query(DocumentType).filter(DocumentType.id == type_id).first()
    if not dt:
        raise HTTPException(status_code=404, detail="Тип документа не найден")
    db.delete(dt)
    db.commit()
    return {"message": "Тип документа удалён"}
