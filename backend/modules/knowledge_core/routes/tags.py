from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, require_it_roles
from backend.modules.knowledge_core.models import KnowledgeTag
from backend.modules.knowledge_core.schemas import KnowledgeTagCreate, KnowledgeTagOut

router = APIRouter(prefix="/tags", tags=["knowledge-tags"])


@router.get(
    "/",
    response_model=List[KnowledgeTagOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def list_tags(
    db: Session = Depends(get_db),
    search: Optional[str] = Query(None),
) -> List[KnowledgeTag]:
    q = db.query(KnowledgeTag)
    if search and search.strip():
        q = q.filter(KnowledgeTag.name.ilike(f"%{search.strip()}%"))
    return q.order_by(KnowledgeTag.name).all()


@router.get(
    "/popular",
    response_model=List[KnowledgeTagOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def popular_tags(
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100),
) -> List[KnowledgeTag]:
    return (
        db.query(KnowledgeTag)
        .order_by(desc(KnowledgeTag.usage_count), KnowledgeTag.name)
        .limit(limit)
        .all()
    )


@router.post(
    "/",
    response_model=KnowledgeTagOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_tag(payload: KnowledgeTagCreate, db: Session = Depends(get_db)):
    existing = db.query(KnowledgeTag).filter(KnowledgeTag.name == payload.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Тег с таким именем уже существует")

    tag = KnowledgeTag(
        name=payload.name.strip(),
        color=payload.color,
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete(
    "/{tag_id}",
    status_code=204,
    dependencies=[Depends(require_it_roles(["admin"]))],
)
def delete_tag(tag_id: UUID, db: Session = Depends(get_db)):
    tag = db.query(KnowledgeTag).filter(KnowledgeTag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Тег не найден")
    db.delete(tag)
    db.commit()
