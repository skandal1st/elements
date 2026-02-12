"""
Сервис поиска по базе знаний: fulltext (tsvector), keyword (ILIKE), hybrid.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, text, or_, desc
from sqlalchemy.orm import Session

from backend.modules.knowledge_core.models import (
    ArticleKeyword,
    KnowledgeArticle,
    SearchQuery,
)

logger = logging.getLogger(__name__)


def fulltext_search(
    db: Session,
    query: str,
    *,
    status: Optional[str] = None,
    category_id: Optional[UUID] = None,
    article_type: Optional[str] = None,
    difficulty_level: Optional[str] = None,
    tag_ids: Optional[list[UUID]] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[KnowledgeArticle], int, list[float]]:
    """
    PostgreSQL fulltext search via ts_rank on search_vector.

    Returns: (articles, total_count, ranks)
    """
    ts_query = func.plainto_tsquery("russian", query)
    rank_expr = func.ts_rank(text("knowledge_articles.search_vector"), ts_query)

    q = db.query(KnowledgeArticle, rank_expr).filter(
        text("knowledge_articles.search_vector @@ plainto_tsquery('russian', :q)").bindparams(q=query)
    )

    q = _apply_filters(q, status=status, category_id=category_id, article_type=article_type,
                        difficulty_level=difficulty_level, tag_ids=tag_ids, db=db)

    total = q.count()
    rows = q.order_by(rank_expr.desc()).offset(offset).limit(limit).all()

    articles = [row[0] for row in rows]
    ranks = [float(row[1]) for row in rows]
    return articles, total, ranks


def keyword_search(
    db: Session,
    query: str,
    *,
    status: Optional[str] = None,
    category_id: Optional[UUID] = None,
    article_type: Optional[str] = None,
    difficulty_level: Optional[str] = None,
    tag_ids: Optional[list[UUID]] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[KnowledgeArticle], int]:
    """ILIKE fallback search on title/summary/raw_content."""
    pattern = f"%{query.strip()}%"
    q = db.query(KnowledgeArticle).filter(
        or_(
            KnowledgeArticle.title.ilike(pattern),
            KnowledgeArticle.summary.ilike(pattern),
            KnowledgeArticle.raw_content.ilike(pattern),
            KnowledgeArticle.normalized_content.ilike(pattern),
        )
    )

    q = _apply_filters(q, status=status, category_id=category_id, article_type=article_type,
                        difficulty_level=difficulty_level, tag_ids=tag_ids, db=db)

    total = q.count()
    articles = q.order_by(KnowledgeArticle.updated_at.desc()).offset(offset).limit(limit).all()
    return articles, total


def hybrid_search(
    db: Session,
    query: str,
    *,
    status: Optional[str] = None,
    category_id: Optional[UUID] = None,
    article_type: Optional[str] = None,
    difficulty_level: Optional[str] = None,
    tag_ids: Optional[list[UUID]] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[KnowledgeArticle], int, list[float], str]:
    """
    Fulltext first; if no results, falls back to keyword search.

    Returns: (articles, total, ranks, actual_search_type)
    """
    articles, total, ranks = fulltext_search(
        db, query, status=status, category_id=category_id,
        article_type=article_type, difficulty_level=difficulty_level,
        tag_ids=tag_ids, limit=limit, offset=offset,
    )
    if articles:
        return articles, total, ranks, "fulltext"

    articles, total = keyword_search(
        db, query, status=status, category_id=category_id,
        article_type=article_type, difficulty_level=difficulty_level,
        tag_ids=tag_ids, limit=limit, offset=offset,
    )
    ranks = [0.0] * len(articles)
    return articles, total, ranks, "keyword"


def autocomplete(
    db: Session,
    query: str,
    limit: int = 10,
) -> list[str]:
    """Title + keyword prefix matching for autocomplete."""
    if not query or len(query.strip()) < 2:
        return []

    pattern = f"{query.strip()}%"
    pattern_contains = f"%{query.strip()}%"

    # Title matches (prefix)
    title_rows = (
        db.query(KnowledgeArticle.title)
        .filter(
            KnowledgeArticle.title.ilike(pattern_contains),
            KnowledgeArticle.status.notin_(["archived"]),
        )
        .order_by(KnowledgeArticle.views_count.desc())
        .limit(limit)
        .all()
    )

    # Keyword matches (prefix)
    keyword_rows = (
        db.query(ArticleKeyword.keyword)
        .filter(ArticleKeyword.keyword.ilike(pattern))
        .distinct()
        .limit(limit)
        .all()
    )

    seen: set[str] = set()
    suggestions: list[str] = []
    for (title,) in title_rows:
        lower = title.lower()
        if lower not in seen:
            seen.add(lower)
            suggestions.append(title)
    for (kw,) in keyword_rows:
        lower = kw.lower()
        if lower not in seen:
            seen.add(lower)
            suggestions.append(kw)

    return suggestions[:limit]


def log_search_query(
    db: Session,
    query_text: str,
    results_count: int,
    search_type: str,
    user_id: Optional[UUID] = None,
) -> None:
    """Логирует поисковый запрос для аналитики."""
    sq = SearchQuery(
        query_text=query_text[:500],
        results_count=results_count,
        search_type=search_type,
        user_id=user_id,
    )
    db.add(sq)
    try:
        db.commit()
    except Exception:
        db.rollback()


def get_popular_queries(db: Session, days: int = 30, limit: int = 10) -> list[dict]:
    """Топ поисковых запросов за последние N дней."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(
            SearchQuery.query_text,
            func.count(SearchQuery.id).label("cnt"),
        )
        .filter(SearchQuery.created_at >= since)
        .group_by(SearchQuery.query_text)
        .order_by(desc("cnt"))
        .limit(limit)
        .all()
    )
    return [{"query": r[0], "count": r[1]} for r in rows]


# ---------------------------------------------------------------------------
# internal helpers
# ---------------------------------------------------------------------------

def _apply_filters(q, *, status, category_id, article_type, difficulty_level, tag_ids, db):
    if status:
        q = q.filter(KnowledgeArticle.status == status)
    if category_id:
        q = q.filter(KnowledgeArticle.category_id == category_id)
    if article_type:
        q = q.filter(KnowledgeArticle.article_type == article_type)
    if difficulty_level:
        q = q.filter(KnowledgeArticle.difficulty_level == difficulty_level)
    if tag_ids:
        from backend.modules.knowledge_core.models import KnowledgeArticleTag
        for tid in tag_ids:
            q = q.filter(
                KnowledgeArticle.id.in_(
                    db.query(KnowledgeArticleTag.article_id).filter(KnowledgeArticleTag.tag_id == tid)
                )
            )
    return q
