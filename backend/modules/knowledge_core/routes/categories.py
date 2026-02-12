import re
import unicodedata
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, require_it_roles
from backend.modules.knowledge_core.models import KnowledgeArticle, KnowledgeCategory
from backend.modules.knowledge_core.schemas import (
    KnowledgeCategoryCreate,
    KnowledgeCategoryOut,
    KnowledgeCategoryTreeOut,
    KnowledgeCategoryUpdate,
)

router = APIRouter(prefix="/categories", tags=["knowledge-categories"])

# Transliteration map for Cyrillic → Latin slug
_TRANSLIT = str.maketrans(
    "абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
    "abvgdeezziiklmnoprstufhcchshshieua",
)


def _slugify(name: str) -> str:
    """Generate a URL-safe slug from name (supports Cyrillic)."""
    s = name.lower().strip()
    s = s.translate(_TRANSLIT)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "category"


def _ensure_unique_slug(db: Session, slug: str, exclude_id: Optional[UUID] = None) -> str:
    """Append a numeric suffix if slug is taken."""
    candidate = slug
    suffix = 1
    while True:
        q = db.query(KnowledgeCategory.id).filter(KnowledgeCategory.slug == candidate)
        if exclude_id:
            q = q.filter(KnowledgeCategory.id != exclude_id)
        if not q.first():
            return candidate
        candidate = f"{slug}-{suffix}"
        suffix += 1


@router.get(
    "/",
    response_model=List[KnowledgeCategoryOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def list_categories(db: Session = Depends(get_db)) -> List[KnowledgeCategory]:
    return (
        db.query(KnowledgeCategory)
        .order_by(KnowledgeCategory.sort_order, KnowledgeCategory.name)
        .all()
    )


@router.get(
    "/tree",
    response_model=List[KnowledgeCategoryTreeOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def category_tree(db: Session = Depends(get_db)):
    all_cats = (
        db.query(KnowledgeCategory)
        .filter(KnowledgeCategory.is_active == True)
        .order_by(KnowledgeCategory.sort_order, KnowledgeCategory.name)
        .all()
    )

    by_parent: dict[Optional[UUID], list] = {}
    for c in all_cats:
        by_parent.setdefault(c.parent_id, []).append(c)

    def build(parent_id: Optional[UUID]) -> list:
        result = []
        for c in by_parent.get(parent_id, []):
            node = KnowledgeCategoryTreeOut.model_validate(c)
            node.children = build(c.id)
            result.append(node)
        return result

    return build(None)


@router.get(
    "/{category_id}",
    response_model=KnowledgeCategoryOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def get_category(category_id: UUID, db: Session = Depends(get_db)):
    c = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == category_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    return c


@router.post(
    "/",
    response_model=KnowledgeCategoryOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_category(payload: KnowledgeCategoryCreate, db: Session = Depends(get_db)):
    slug = _ensure_unique_slug(db, _slugify(payload.name))

    if payload.parent_id:
        parent = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == payload.parent_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Родительская категория не найдена")

    c = KnowledgeCategory(
        name=payload.name.strip(),
        slug=slug,
        description=payload.description,
        icon=payload.icon,
        color=payload.color,
        parent_id=payload.parent_id,
        sort_order=payload.sort_order,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.patch(
    "/{category_id}",
    response_model=KnowledgeCategoryOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def update_category(category_id: UUID, payload: KnowledgeCategoryUpdate, db: Session = Depends(get_db)):
    c = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == category_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Категория не найдена")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        c.name = data["name"].strip()
        c.slug = _ensure_unique_slug(db, _slugify(c.name), exclude_id=c.id)
    for field in ("description", "icon", "color", "parent_id", "sort_order", "is_active"):
        if field in data and data[field] is not None:
            setattr(c, field, data[field])

    db.commit()
    db.refresh(c)
    return c


@router.delete(
    "/{category_id}",
    status_code=204,
    dependencies=[Depends(require_it_roles(["admin"]))],
)
def delete_category(category_id: UUID, db: Session = Depends(get_db)):
    c = db.query(KnowledgeCategory).filter(KnowledgeCategory.id == category_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Категория не найдена")

    # Check if category has articles
    has_articles = db.query(KnowledgeArticle.id).filter(KnowledgeArticle.category_id == category_id).first()
    if has_articles:
        raise HTTPException(status_code=400, detail="Нельзя удалить категорию с привязанными статьями")

    # Check if category has children
    has_children = db.query(KnowledgeCategory.id).filter(KnowledgeCategory.parent_id == category_id).first()
    if has_children:
        raise HTTPException(status_code=400, detail="Нельзя удалить категорию с дочерними категориями")

    db.delete(c)
    db.commit()
