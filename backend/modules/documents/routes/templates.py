"""Роуты /documents/templates — шаблоны документов с плейсхолдерами."""
import uuid as uuid_mod
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.modules.documents.dependencies import get_db, get_current_user, require_documents_roles
from backend.modules.documents.models import Document, DocumentTemplate, DocumentVersion
from backend.modules.documents.schemas.template import (
    GenerateFromTemplateRequest,
    SetPlaceholderRequest,
    TemplateOut,
    TemplateUpdate,
)
from backend.modules.documents.schemas.document import DocumentOut
from backend.modules.documents.services.file_service import get_absolute_path, save_document_file
from backend.modules.documents.services.template_service import (
    get_template_html_content,
    replace_text_with_placeholder,
    generate_document_from_template,
)
from backend.modules.hr.models.user import User

router = APIRouter(prefix="/templates", tags=["document-templates"])


@router.get("/", response_model=List[TemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    document_type_id: Optional[UUID] = Query(None),
    active: Optional[bool] = Query(None),
):
    q = db.query(DocumentTemplate).order_by(DocumentTemplate.name)
    if document_type_id:
        q = q.filter(DocumentTemplate.document_type_id == document_type_id)
    if active is True:
        q = q.filter(DocumentTemplate.is_active == True)
    return q.all()


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    return t


@router.post("/upload", response_model=TemplateOut, status_code=201)
async def upload_template(
    file: UploadFile = File(...),
    name: str = Query(...),
    description: Optional[str] = Query(None),
    document_type_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin", "specialist"])),
):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Поддерживаются только .docx файлы")

    try:
        file_info = await save_document_file(file, subfolder="templates")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    template = DocumentTemplate(
        name=name.strip(),
        description=(description or "").strip() or None,
        document_type_id=document_type_id,
        file_path=file_info["file_path"],
        file_name=file_info["file_name"],
        placeholders=[],
        version=1,
        is_active=True,
        created_by=current_user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.patch("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: UUID,
    payload: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin", "specialist"])),
):
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    if payload.name is not None:
        t.name = payload.name.strip()
    if payload.description is not None:
        t.description = payload.description.strip() or None
    if payload.document_type_id is not None:
        t.document_type_id = payload.document_type_id
    if payload.is_active is not None:
        t.is_active = payload.is_active
    if payload.placeholders is not None:
        t.placeholders = [p.model_dump() for p in payload.placeholders]
    db.commit()
    db.refresh(t)
    return t


@router.get("/{template_id}/content")
def get_template_content(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Возвращает содержимое .docx шаблона как HTML для превью."""
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    abs_path = get_absolute_path(t.file_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Файл шаблона не найден на диске")
    try:
        html = get_template_html_content(str(abs_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка парсинга шаблона: {e}")
    return {"html": html, "placeholders": t.placeholders}


@router.post("/{template_id}/set-placeholder", response_model=TemplateOut)
def set_placeholder(
    template_id: UUID,
    payload: SetPlaceholderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin", "specialist"])),
):
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    abs_path = get_absolute_path(t.file_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Файл шаблона не найден на диске")

    try:
        replace_text_with_placeholder(
            str(abs_path),
            payload.paragraph_index,
            payload.start,
            payload.end,
            payload.placeholder.key,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка установки плейсхолдера: {e}")

    # Обновляем список плейсхолдеров
    placeholders = list(t.placeholders or [])
    ph = payload.placeholder.model_dump()
    if not ph.get("id"):
        ph["id"] = uuid_mod.uuid4().hex
    # Удаляем старый плейсхолдер с тем же ключом
    placeholders = [p for p in placeholders if p.get("key") != ph["key"]]
    placeholders.append(ph)
    t.placeholders = placeholders
    t.version += 1
    db.commit()
    db.refresh(t)
    return t


@router.get("/{template_id}/download")
def download_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    abs_path = get_absolute_path(t.file_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Файл не найден на диске")
    return FileResponse(
        path=str(abs_path),
        filename=t.file_name,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.delete("/{template_id}", status_code=200)
def delete_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_documents_roles(["admin"])),
):
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    db.delete(t)
    db.commit()
    return {"message": "Шаблон удалён"}


@router.post("/from-template", response_model=DocumentOut, status_code=201)
def create_from_template(
    payload: GenerateFromTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(DocumentTemplate).filter(DocumentTemplate.id == payload.template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    abs_path = get_absolute_path(t.file_path)
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Файл шаблона не найден на диске")

    try:
        result = generate_document_from_template(str(abs_path), payload.values)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации документа: {e}")

    doc_type_id = payload.document_type_id or t.document_type_id
    route_id = payload.approval_route_id
    if not route_id and doc_type_id:
        from backend.modules.documents.models import DocumentType
        dt = db.query(DocumentType).filter(DocumentType.id == doc_type_id).first()
        if dt and dt.default_route_id:
            route_id = dt.default_route_id

    doc = Document(
        title=payload.title.strip(),
        description=(payload.description or "").strip() or None,
        document_type_id=doc_type_id,
        template_id=t.id,
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
        file_path=result["file_path"],
        file_name=result["file_name"],
        file_size=result["file_size"],
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        change_note="Сгенерировано из шаблона",
        created_by=current_user.id,
    )
    db.add(version)
    db.commit()
    db.refresh(doc)

    creator = db.query(User).filter(User.id == doc.creator_id).first()
    data = {c.name: getattr(doc, c.name) for c in doc.__table__.columns}
    data["creator_name"] = creator.full_name if creator else None
    data["document_type_name"] = None
    if doc.document_type:
        data["document_type_name"] = doc.document_type.name
    return data
