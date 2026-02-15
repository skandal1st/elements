"""
API роуты для модуля Документы.
Префикс: /api/v1/documents.

Порядок include_router важен: роуты с фиксированными путями (my-approvals,
/types, /templates, /routes) должны быть зарегистрированы ДО роутов с
path-параметром /{document_id}, иначе FastAPI попытается распарсить
фиксированный сегмент как UUID и вернёт 422.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload

from backend.core.config import settings
from backend.modules.documents.dependencies import get_db, get_current_user
from backend.modules.documents.models import ApprovalInstance, Document
from backend.modules.documents.services.file_service import get_absolute_path
from backend.modules.hr.models.user import User

from .routes import (
    approval_routes,
    approvals,
    comments,
    document_types,
    documents,
    templates,
)

router = APIRouter(prefix=f"{settings.api_v1_prefix}/documents", tags=["documents"])

# 1. Роуты с фиксированными префиксами — не конфликтуют с /{document_id}
router.include_router(document_types.router)   # /types/*
router.include_router(templates.router)        # /templates/*
router.include_router(approval_routes.router)  # /routes/*

# 2. approvals содержит GET /my-approvals — ДОЛЖЕН быть ДО documents.router,
#    иначе /{document_id} перехватит "my-approvals" и вернёт 422
router.include_router(approvals.router)

# 3. documents.router (без префикса) — содержит /{document_id}, поэтому последний
router.include_router(documents.router)
router.include_router(comments.router)


@router.get("/{document_id}/approval-sheet")
def download_approval_sheet(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Скачать PDF лист согласования."""
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
        .options(joinedload(ApprovalInstance.step_instances))
        .filter(ApprovalInstance.document_id == document_id)
        .order_by(ApprovalInstance.attempt.desc())
        .first()
    )
    if not instance:
        raise HTTPException(status_code=400, detail="Нет данных о согласовании")

    try:
        from backend.modules.documents.services.approval_sheet_service import (
            generate_approval_sheet_pdf,
        )
        pdf_path = generate_approval_sheet_pdf(db, doc, instance)
    except ImportError:
        raise HTTPException(status_code=500, detail="Библиотека reportlab не установлена")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка генерации PDF: {e}")

    abs_path = get_absolute_path(pdf_path)
    if not abs_path.exists():
        raise HTTPException(status_code=500, detail="Не удалось создать PDF")

    return FileResponse(
        path=str(abs_path),
        filename=f"approval_sheet_{doc.title[:50]}.pdf",
        media_type="application/pdf",
    )
