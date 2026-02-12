from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.hr.models.user import User
from backend.modules.knowledge_core.schemas import (
    AutocompleteResponse,
    KnowledgeTagOut,
    SearchResponse,
    SearchResultItem,
)
from backend.modules.knowledge_core.services.search_service import (
    autocomplete,
    get_popular_queries,
    hybrid_search,
    log_search_query,
)

router = APIRouter(prefix="/search", tags=["knowledge-search"])


@router.get(
    "/",
    response_model=SearchResponse,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def search_articles(
    q: str = Query(..., min_length=1),
    type: str = Query("hybrid", regex="^(fulltext|keyword|hybrid)$"),
    category_id: Optional[UUID] = Query(None),
    tag_ids: Optional[str] = Query(None, description="Comma-separated tag UUIDs"),
    status: Optional[str] = Query(None),
    article_type: Optional[str] = Query(None),
    difficulty_level: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    parsed_tag_ids: Optional[list[UUID]] = None
    if tag_ids:
        parsed_tag_ids = [UUID(t.strip()) for t in tag_ids.split(",") if t.strip()]

    articles, total, ranks, actual_type = hybrid_search(
        db, q,
        status=status,
        category_id=category_id,
        article_type=article_type,
        difficulty_level=difficulty_level,
        tag_ids=parsed_tag_ids,
        limit=limit,
        offset=offset,
    )

    items: list[SearchResultItem] = []
    for article, rank in zip(articles, ranks):
        tags_out = [KnowledgeTagOut.model_validate(t) for t in (article.tags or [])]
        items.append(SearchResultItem(
            id=article.id,
            title=article.title,
            summary=article.summary,
            status=article.status,
            article_type=article.article_type,
            category_id=article.category_id,
            difficulty_level=article.difficulty_level,
            views_count=article.views_count or 0,
            helpful_count=article.helpful_count or 0,
            tags=tags_out,
            rank=rank,
            updated_at=article.updated_at,
        ))

    # async log (best-effort)
    log_search_query(db, q, total, actual_type, user_id=user.id)

    return SearchResponse(items=items, total=total, query=q, search_type=actual_type)


@router.get(
    "/autocomplete",
    response_model=AutocompleteResponse,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def autocomplete_endpoint(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
):
    suggestions = autocomplete(db, q, limit=limit)
    return AutocompleteResponse(suggestions=suggestions)


@router.get(
    "/popular",
    response_model=List[dict],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def popular_queries(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return get_popular_queries(db, days=days, limit=limit)
