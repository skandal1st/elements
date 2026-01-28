from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, require_it_roles
import hashlib
import logging

from backend.modules.it.models import Ticket
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.knowledge_core.models import KnowledgeArticle, LLMRequestLog
from backend.modules.knowledge_core.schemas import (
    ArticleFromTicketCreate,
    KnowledgeArticleCreate,
    KnowledgeArticleOut,
    KnowledgeArticleUpdate,
    NormalizeConfirmRequest,
    NormalizePreviewResponse,
)
from backend.modules.knowledge_core.services.llm import normalize_article_text
from backend.modules.knowledge_core.models import KnowledgeArticleIndex
from backend.modules.knowledge_core.services.embeddings import create_embedding
from backend.modules.knowledge_core.services.qdrant import QdrantClient
from backend.core.config import settings
from backend.modules.it.dependencies import get_current_user
from backend.modules.hr.models.user import User


router = APIRouter(prefix="/articles", tags=["knowledge"])
logger = logging.getLogger(__name__)


def _sha256_hex(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()


def _get_settings_map(db: Session, keys: list[str]) -> dict[str, str]:
    rows = (
        db.query(SystemSettings.setting_key, SystemSettings.setting_value)
        .filter(SystemSettings.setting_key.in_(keys))
        .all()
    )
    return {k: (v or "") for k, v in rows}


@router.get(
    "/",
    response_model=List[KnowledgeArticleOut],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def list_articles(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    equipment_id: Optional[UUID] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> List[KnowledgeArticle]:
    q = db.query(KnowledgeArticle)
    if status:
        q = q.filter(KnowledgeArticle.status == status)
    if source:
        q = q.filter(KnowledgeArticle.source == source)
    if equipment_id:
        q = q.filter(KnowledgeArticle.equipment_ids.any(equipment_id))
    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.filter(KnowledgeArticle.title.ilike(s))
    q = q.order_by(KnowledgeArticle.updated_at.desc())
    return q.limit(limit).all()


@router.get(
    "/{article_id}",
    response_model=KnowledgeArticleOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
def get_article(article_id: UUID, db: Session = Depends(get_db)) -> KnowledgeArticle:
    a = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return a


@router.post(
    "/",
    response_model=KnowledgeArticleOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_article(
    payload: KnowledgeArticleCreate, db: Session = Depends(get_db)
) -> KnowledgeArticle:
    a = KnowledgeArticle(
        title=payload.title.strip(),
        status="draft",
        source="manual",
        raw_content=(payload.raw_content or None),
        equipment_ids=list(payload.equipment_ids or []),
        linked_article_ids=list(payload.linked_article_ids or []),
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.patch(
    "/{article_id}",
    response_model=KnowledgeArticleOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def update_article(
    article_id: UUID, payload: KnowledgeArticleUpdate, db: Session = Depends(get_db)
) -> KnowledgeArticle:
    a = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Статья не найдена")

    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        a.title = data["title"].strip()
    if "status" in data and data["status"] is not None:
        a.status = data["status"]
    if "raw_content" in data:
        a.raw_content = data["raw_content"]
    if "equipment_ids" in data and data["equipment_ids"] is not None:
        a.equipment_ids = list(data["equipment_ids"])
    if "linked_article_ids" in data and data["linked_article_ids"] is not None:
        a.linked_article_ids = list(data["linked_article_ids"])
    if "is_typical" in data and data["is_typical"] is not None:
        a.is_typical = bool(data["is_typical"])

    db.commit()
    db.refresh(a)
    return a


@router.post(
    "/from-ticket/{ticket_id}",
    response_model=KnowledgeArticleOut,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_article_from_ticket(
    ticket_id: UUID,
    payload: ArticleFromTicketCreate,
    db: Session = Depends(get_db),
) -> KnowledgeArticle:
    t = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Тикет не найден")
    if t.status != "closed":
        raise HTTPException(
            status_code=400, detail="Статья может быть создана только из закрытого тикета"
        )

    title = (payload.title or t.title or "").strip()
    if not title:
        title = "Без названия"

    parts = [
        f"Ticket: {t.id}",
        f"Ticket title: {t.title}",
        "",
        "Problem:",
        payload.problem.strip(),
        "",
        "Actions performed:",
        payload.actions.strip(),
        "",
        "Key solution:",
        payload.solution.strip(),
        "",
        f"Typical solution: {'yes' if payload.is_typical else 'no'}",
    ]
    raw = "\n".join(parts).strip()

    equipment_ids: list[UUID] = []
    if t.equipment_id:
        equipment_ids.append(t.equipment_id)

    a = KnowledgeArticle(
        title=title,
        status="unprocessed",
        source="ticket",
        raw_content=raw,
        normalized_content=None,
        normalization_version=0,
        normalized_by=None,
        created_from_ticket_id=t.id,
        equipment_ids=equipment_ids,
        linked_article_ids=[],
        confidence_score=0,
        is_typical=payload.is_typical,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.post(
    "/{article_id}/normalize/preview",
    response_model=NormalizePreviewResponse,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def normalize_preview(
    article_id: UUID,
    db: Session = Depends(get_db),
) -> NormalizePreviewResponse:
    a = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    if not a.raw_content or not a.raw_content.strip():
        raise HTTPException(status_code=400, detail="raw_content пустой")

    log = LLMRequestLog(
        kind="knowledge_normalization",
        model=None,
        request_text=a.raw_content,
        response_text=None,
        success=False,
        duration_ms=None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    try:
        rows = (
            db.query(SystemSettings.setting_key, SystemSettings.setting_value)
            .filter(
                SystemSettings.setting_key.in_(
                    [
                        "llm_normalization_enabled",
                        "openrouter_api_key",
                        "openrouter_base_url",
                        "openrouter_model",
                    ]
                )
            )
            .all()
        )
        cfg = {k: v for k, v in rows}

        enabled_raw = cfg.get("llm_normalization_enabled")
        enabled = (
            enabled_raw.lower() == "true"
            if isinstance(enabled_raw, str)
            else bool(enabled_raw)
        )
        api_key = cfg.get("openrouter_api_key") or settings.openrouter_api_key
        base_url = cfg.get("openrouter_base_url") or settings.openrouter_base_url
        model = cfg.get("openrouter_model") or settings.openrouter_model

        normalized, meta = await normalize_article_text(
            a.raw_content,
            enabled=enabled if enabled_raw is not None else settings.llm_normalization_enabled,
            api_key=api_key,
            base_url=base_url,
            model=model,
        )
        log.model = meta.get("model")
        log.response_text = normalized
        log.success = True
        log.duration_ms = meta.get("duration_ms")
        db.commit()
        return NormalizePreviewResponse(
            normalized_content=normalized,
            normalization_version=a.normalization_version + 1,
        )
    except Exception as e:
        log.response_text = str(e)
        log.success = False
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{article_id}/normalize/confirm",
    response_model=KnowledgeArticleOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def normalize_confirm(
    article_id: UUID,
    payload: NormalizeConfirmRequest,
    db: Session = Depends(get_db),
) -> KnowledgeArticle:
    a = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Статья не найдена")

    a.normalized_content = payload.normalized_content
    a.normalized_by = payload.normalized_by
    a.normalization_version = int(a.normalization_version or 0) + 1
    a.status = "normalized"

    db.commit()
    db.refresh(a)

    # Stage 2: индексируем в Qdrant (best-effort, не ломаем подтверждение)
    try:
        cfg = _get_settings_map(
            db,
            [
                "openrouter_api_key",
                "openrouter_base_url",
                "openrouter_embedding_model",
                "qdrant_url",
                "qdrant_collection",
            ],
        )
        api_key = cfg.get("openrouter_api_key") or settings.openrouter_api_key
        base_url = cfg.get("openrouter_base_url") or settings.openrouter_base_url
        emb_model = (
            cfg.get("openrouter_embedding_model") or settings.openrouter_embedding_model
        )
        qdrant_url = cfg.get("qdrant_url") or settings.qdrant_url
        qdrant_collection = cfg.get("qdrant_collection") or settings.qdrant_collection

        if not qdrant_url:
            raise RuntimeError("Qdrant не настроен (qdrant_url пустой)")

        content_hash = _sha256_hex(a.normalized_content or "")
        ix = (
            db.query(KnowledgeArticleIndex)
            .filter(KnowledgeArticleIndex.article_id == a.id)
            .first()
        )
        if not ix:
            ix = KnowledgeArticleIndex(
                article_id=a.id,
                embedding_model=emb_model,
                qdrant_collection=qdrant_collection,
                content_hash=content_hash,
                indexed_at=None,
                last_error=None,
            )
            db.add(ix)
            db.commit()
            db.refresh(ix)

        vec, _meta = await create_embedding(
            a.normalized_content or "",
            api_key=api_key,
            base_url=base_url,
            model=emb_model,
        )

        qc = QdrantClient(url=qdrant_url, collection=qdrant_collection)
        await qc.ensure_collection(vector_size=len(vec))
        await qc.upsert_point(
            point_id=str(a.id),
            vector=vec,
            payload={
                "article_id": str(a.id),
                "equipment_ids": [str(x) for x in (a.equipment_ids or [])],
                "confidence_score": int(a.confidence_score or 0),
                "status": a.status,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            },
        )

        from datetime import datetime, timezone

        ix.embedding_model = emb_model
        ix.qdrant_collection = qdrant_collection
        ix.content_hash = content_hash
        ix.indexed_at = datetime.now(timezone.utc)
        ix.last_error = None
        db.commit()
    except Exception as e:
        logger.warning("Indexing failed for article %s: %s", a.id, e)
        try:
            ix = (
                db.query(KnowledgeArticleIndex)
                .filter(KnowledgeArticleIndex.article_id == a.id)
                .first()
            )
            if ix:
                ix.last_error = str(e)
                db.commit()
        except Exception:
            pass
    return a


@router.post(
    "/{article_id}/archive",
    response_model=KnowledgeArticleOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def archive_article(article_id: UUID, db: Session = Depends(get_db)) -> KnowledgeArticle:
    a = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    a.status = "archived"
    db.commit()
    db.refresh(a)
    return a


class ArticleFeedbackRequest(BaseModel):
    helped: bool


@router.post(
    "/{article_id}/feedback",
    response_model=KnowledgeArticleOut,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
async def article_feedback(
    article_id: UUID,
    payload: ArticleFeedbackRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KnowledgeArticle:
    from backend.modules.knowledge_core.models import KnowledgeArticleFeedback

    a = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Статья не найдена")

    delta = 1 if payload.helped else -1
    a.confidence_score = int(a.confidence_score or 0) + delta
    db.add(
        KnowledgeArticleFeedback(article_id=a.id, user_id=user.id, helped=payload.helped)
    )
    db.commit()
    db.refresh(a)

    # best-effort update Qdrant payload
    try:
        cfg = _get_settings_map(db, ["qdrant_url", "qdrant_collection"])
        qdrant_url = cfg.get("qdrant_url") or settings.qdrant_url
        qdrant_collection = cfg.get("qdrant_collection") or settings.qdrant_collection
        if qdrant_url:
            qc = QdrantClient(url=qdrant_url, collection=qdrant_collection)
            await qc.set_payload(
                point_id=str(a.id),
                payload={"confidence_score": int(a.confidence_score or 0)},
            )
    except Exception as e:
        logger.warning("Qdrant payload update failed for %s: %s", a.id, e)

    return a

