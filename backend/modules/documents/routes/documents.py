"""Роуты /documents/ — CRUD документов, версии, вложения, скачивание."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from backend.modules.documents.dependencies import get_db, get_current_user
from backend.modules.documents.models import (
    Document,
    DocumentAttachment,
    DocumentType,
    DocumentVersion,
)
from backend.modules.documents.schemas.document import (
    DocumentAttachmentOut,
    DocumentDetailOut,
    DocumentOut,
    DocumentUpdate,
    DocumentVersionOut,
)
from backend.modules.documents.services.file_service import (
    get_absolute_path,
    save_document_file,
)
from backend.modules.hr.models.user import User

router = APIRouter(tags=["documents"])


def _enrich_document(doc: Document, db: Session) -> dict:
    """Добавляет вычисляемые поля к документу."""
    data = {c.name: getattr(doc, c.name) for c in doc.__table__.columns}
    creator = db.query(User).filter(User.id == doc.creator_id).first()
    data["creator_name"] = creator.full_name if creator else None
    if doc.document_type:
        data["document_type_name"] = doc.document_type.name
    else:
        data["document_type_name"] = None
    return data


@router.get("/", response_model=List[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None),
    document_type_id: Optional[UUID] = Query(None),
    creator_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
):
    q = db.query(Document).options(joinedload(Document.document_type))
    if status:
        q = q.filter(Document.status == status)
    if document_type_id:
        q = q.filter(Document.document_type_id == document_type_id)
    if creator_id:
        q = q.filter(Document.creator_id == creator_id)
    if search:
        q = q.filter(Document.title.ilike(f"%{search}%"))
    q = q.order_by(Document.created_at.desc())
    docs = q.all()
    return [_enrich_document(d, db) for d in docs]


@router.get("/{document_id}", response_model=DocumentDetailOut)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = (
        db.query(Document)
        .options(
            joinedload(Document.document_type),
            joinedload(Document.versions),
            joinedload(Document.attachments),
        )
        .filter(Document.id == document_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    data = _enrich_document(doc, db)
    data["versions"] = doc.versions
    data["attachments"] = doc.attachments
    return data


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Query(...),
    description: Optional[str] = Query(None),
    document_type_id: Optional[UUID] = Query(None),
    approval_route_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Название документа обязательно")

    try:
        file_info = await save_document_file(file, subfolder="files")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Если не указан маршрут, попробовать взять из типа документа
    route_id = approval_route_id
    if not route_id and document_type_id:
        dt = db.query(DocumentType).filter(DocumentType.id == document_type_id).first()
        if dt and dt.default_route_id:
            route_id = dt.default_route_id

    doc = Document(
        title=title,
        description=(description or "").strip() or None,
        document_type_id=document_type_id,
        creator_id=current_user.id,
        approval_route_id=route_id,
        status="draft",
        current_version=1,
    )
    db.add(doc)
    db.flush()

    version = DocumentVersion(
        document_id=doc.id,
        version=1,
        file_path=file_info["file_path"],
        file_name=file_info["file_name"],
        file_size=file_info["file_size"],
        mime_type=file_info["mime_type"],
        change_note="Первоначальная версия",
        created_by=current_user.id,
    )
    db.add(version)
    db.commit()
    db.refresh(doc)
    return _enrich_document(doc, db)


@router.patch("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if doc.creator_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Только создатель может редактировать документ")
    if doc.status not in ("draft", "rejected"):
        raise HTTPException(status_code=400, detail="Редактирование возможно только для черновиков и отклонённых документов")

    if payload.title is not None:
        t = payload.title.strip()
        if not t:
            raise HTTPException(status_code=400, detail="Название не может быть пустым")
        doc.title = t
    if payload.description is not None:
        doc.description = payload.description.strip() or None
    if payload.document_type_id is not None:
        doc.document_type_id = payload.document_type_id
    if payload.approval_route_id is not None:
        doc.approval_route_id = payload.approval_route_id
    db.commit()
    db.refresh(doc)
    return _enrich_document(doc, db)


@router.post("/{document_id}/new-version", response_model=DocumentVersionOut, status_code=201)
async def upload_new_version(
    document_id: UUID,
    file: UploadFile = File(...),
    change_note: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    if doc.creator_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Только создатель может загружать новые версии")

    try:
        file_info = await save_document_file(file, subfolder="files")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    new_version_num = doc.current_version + 1
    version = DocumentVersion(
        document_id=doc.id,
        version=new_version_num,
        file_path=file_info["file_path"],
        file_name=file_info["file_name"],
        file_size=file_info["file_size"],
        mime_type=file_info["mime_type"],
        change_note=(change_note or "").strip() or None,
        created_by=current_user.id,
    )
    db.add(version)
    doc.current_version = new_version_num
    db.commit()
    db.refresh(version)
    return version


@router.get("/{document_id}/versions", response_model=List[DocumentVersionOut])
def list_versions(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    versions = (
        db.query(DocumentVersion)
        .filter(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version.desc())
        .all()
    )
    return versions


@router.get("/{document_id}/versions/{version_num}/download")
def download_version(
    document_id: UUID,
    version_num: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    version = (
        db.query(DocumentVersion)
        .filter(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version == version_num,
        )
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Версия не найдена")
    abs_path = get_absolute_path(version.file_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден на диске")
    return FileResponse(
        path=str(abs_path),
        filename=version.file_name,
        media_type=version.mime_type or "application/octet-stream",
    )


@router.post("/{document_id}/attachments", response_model=DocumentAttachmentOut, status_code=201)
async def add_attachment(
    document_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")

    try:
        file_info = await save_document_file(file, subfolder="attachments")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    attachment = DocumentAttachment(
        document_id=doc.id,
        file_path=file_info["file_path"],
        file_name=file_info["file_name"],
        file_size=file_info["file_size"],
        mime_type=file_info["mime_type"],
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get("/{document_id}/attachments", response_model=List[DocumentAttachmentOut])
def list_attachments(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    return (
        db.query(DocumentAttachment)
        .filter(DocumentAttachment.document_id == document_id)
        .order_by(DocumentAttachment.created_at.desc())
        .all()
    )
