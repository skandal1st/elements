"""Роуты комментариев к документам."""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.documents.dependencies import get_db, get_current_user
from backend.modules.documents.models import Document, DocumentComment
from backend.modules.documents.schemas.comment import CommentCreate, CommentOut
from backend.modules.hr.models.user import User

router = APIRouter(tags=["document-comments"])


@router.post("/{document_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(
    document_id: UUID,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Текст комментария обязателен")
    comment = DocumentComment(
        document_id=doc.id,
        user_id=current_user.id,
        content=content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        **{c.name: getattr(comment, c.name) for c in comment.__table__.columns},
        "user_name": current_user.full_name,
    }


@router.get("/{document_id}/comments", response_model=List[CommentOut])
def list_comments(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    comments = (
        db.query(DocumentComment)
        .filter(DocumentComment.document_id == document_id)
        .order_by(DocumentComment.created_at.desc())
        .all()
    )
    result = []
    for c in comments:
        user = db.query(User).filter(User.id == c.user_id).first()
        result.append({
            **{col.name: getattr(c, col.name) for col in c.__table__.columns},
            "user_name": user.full_name if user else None,
        })
    return result
