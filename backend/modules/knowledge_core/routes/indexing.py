import hashlib
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.it.dependencies import get_db, require_it_roles
from backend.modules.knowledge_core.models import KnowledgeArticle, KnowledgeArticleIndex
from backend.modules.knowledge_core.services.embeddings import create_embedding
from backend.modules.knowledge_core.services.qdrant import QdrantClient


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/index", tags=["knowledge"])


def _sha256_hex(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()


def _get_settings_map(db: Session, keys: list[str]) -> dict[str, str]:
    rows = (
        db.query(SystemSettings.setting_key, SystemSettings.setting_value)
        .filter(SystemSettings.setting_key.in_(keys))
        .all()
    )
    return {k: (v or "") for k, v in rows}


def _bool_from_settings(val: str, default: bool = False) -> bool:
    if val is None:
        return default
    v = str(val).strip().lower()
    if v in ("true", "1", "yes", "y", "on"):
        return True
    if v in ("false", "0", "no", "n", "off"):
        return False
    return default


async def _index_article(db: Session, a: KnowledgeArticle) -> None:
    if not a.normalized_content or not a.normalized_content.strip():
        raise RuntimeError("normalized_content пустой")
    if a.status != "normalized":
        raise RuntimeError("статья не в статусе normalized")

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
    emb_model = cfg.get("openrouter_embedding_model") or settings.openrouter_embedding_model

    qdrant_url = cfg.get("qdrant_url") or settings.qdrant_url
    qdrant_collection = cfg.get("qdrant_collection") or settings.qdrant_collection
    if not qdrant_url:
        raise RuntimeError("Qdrant не настроен (qdrant_url пустой)")

    content_hash = _sha256_hex(a.normalized_content)

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

    # Skip if already indexed with same hash/model/collection
    if (
        ix.indexed_at is not None
        and ix.content_hash == content_hash
        and ix.embedding_model == emb_model
        and ix.qdrant_collection == qdrant_collection
        and not ix.last_error
    ):
        return

    vec, _meta = await create_embedding(
        a.normalized_content,
        api_key=api_key,
        base_url=base_url,
        model=emb_model,
    )

    qc = QdrantClient(url=qdrant_url, collection=qdrant_collection)
    await qc.ensure_collection(vector_size=len(vec))
    payload = {
        "article_id": str(a.id),
        "equipment_ids": [str(x) for x in (a.equipment_ids or [])],
        "confidence_score": int(a.confidence_score or 0),
        "status": a.status,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }
    await qc.upsert_point(point_id=str(a.id), vector=vec, payload=payload)

    ix.embedding_model = emb_model
    ix.qdrant_collection = qdrant_collection
    ix.content_hash = content_hash
    ix.indexed_at = datetime.now(timezone.utc)
    ix.last_error = None
    db.commit()


@router.post(
    "/rebuild",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def rebuild_index(db: Session = Depends(get_db)) -> dict:
    """
    Переиндексировать все нормализованные статьи.
    """
    articles = (
        db.query(KnowledgeArticle)
        .filter(KnowledgeArticle.status == "normalized")
        .order_by(KnowledgeArticle.updated_at.desc())
        .all()
    )
    ok = 0
    failed = 0
    errors: list[str] = []
    for a in articles:
        try:
            await _index_article(db, a)
            ok += 1
        except Exception as e:
            failed += 1
            errors.append(f"{a.id}: {e}")
            # фиксируем ошибку в index row
            ix = (
                db.query(KnowledgeArticleIndex)
                .filter(KnowledgeArticleIndex.article_id == a.id)
                .first()
            )
            if ix:
                ix.last_error = str(e)
                db.commit()
    return {"indexed": ok, "failed": failed, "errors": errors[:20]}


@router.post(
    "/article/{article_id}",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def reindex_article(article_id: UUID, db: Session = Depends(get_db)) -> dict:
    a = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    await _index_article(db, a)
    return {"ok": True, "article_id": str(article_id)}

import hashlib
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.it.dependencies import get_db, require_it_roles
from backend.modules.knowledge_core.models import KnowledgeArticle, KnowledgeArticleIndex
from backend.modules.knowledge_core.services.embeddings import create_embedding
from backend.modules.knowledge_core.services.qdrant import QdrantClient


router = APIRouter(prefix="/index", tags=["knowledge"])

UTC = timezone.utc


def _hash_text(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _get_settings_map(db: Session, keys: list[str]) -> dict[str, Optional[str]]:
    rows = (
        db.query(SystemSettings.setting_key, SystemSettings.setting_value)
        .filter(SystemSettings.setting_key.in_(keys))
        .all()
    )
    return {k: v for k, v in rows}


async def index_article(db: Session, article: KnowledgeArticle) -> None:
    if not article.normalized_content or not article.normalized_content.strip():
        raise RuntimeError("normalized_content пустой")

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
    emb_model = cfg.get("openrouter_embedding_model") or settings.openrouter_embedding_model

    qdrant_url = cfg.get("qdrant_url") or settings.qdrant_url or ""
    qdrant_collection = cfg.get("qdrant_collection") or settings.qdrant_collection
    if not qdrant_url:
        # fallback: env injected via docker-compose
        qdrant_url = settings.qdrant_url or ""

    vector, meta = await create_embedding(
        article.normalized_content,
        api_key=api_key,
        base_url=base_url,
        model=emb_model,
    )

    qc = QdrantClient(url=qdrant_url, collection=qdrant_collection)
    await qc.ensure_collection(vector_size=int(meta.get("dim") or len(vector)))

    payload = {
        "article_id": str(article.id),
        "equipment_ids": [str(x) for x in (article.equipment_ids or [])],
        "confidence_score": int(article.confidence_score or 0),
        "status": article.status,
        "updated_at": (article.updated_at.isoformat() if article.updated_at else None),
    }

    await qc.upsert_point(
        point_id=str(article.id),
        vector=vector,
        payload=payload,
    )

    content_hash = _hash_text(article.normalized_content)
    idx = (
        db.query(KnowledgeArticleIndex)
        .filter(KnowledgeArticleIndex.article_id == article.id)
        .first()
    )
    if idx:
        idx.embedding_model = emb_model
        idx.qdrant_collection = qdrant_collection
        idx.content_hash = content_hash
        idx.indexed_at = datetime.now(tz=UTC)
        idx.last_error = None
    else:
        idx = KnowledgeArticleIndex(
            article_id=article.id,
            embedding_model=emb_model,
            qdrant_collection=qdrant_collection,
            content_hash=content_hash,
            indexed_at=datetime.now(tz=UTC),
            last_error=None,
        )
        db.add(idx)
    db.commit()


@router.post(
    "/rebuild",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def rebuild_index(db: Session = Depends(get_db)) -> dict:
    """
    Переиндексирует все нормализованные статьи в Qdrant.
    """
    articles = (
        db.query(KnowledgeArticle)
        .filter(KnowledgeArticle.status == "normalized")
        .order_by(KnowledgeArticle.updated_at.desc())
        .all()
    )
    ok = 0
    failed = 0
    errors: list[str] = []
    for a in articles:
        try:
            await index_article(db, a)
            ok += 1
        except Exception as e:
            failed += 1
            errors.append(f"{a.id}: {e}")
            # сохраняем ошибку в индексе
            idx = (
                db.query(KnowledgeArticleIndex)
                .filter(KnowledgeArticleIndex.article_id == a.id)
                .first()
            )
            if idx:
                idx.last_error = str(e)
                db.commit()
            else:
                db.add(
                    KnowledgeArticleIndex(
                        article_id=a.id,
                        embedding_model="",
                        qdrant_collection="",
                        content_hash=_hash_text(a.normalized_content or ""),
                        indexed_at=None,
                        last_error=str(e),
                    )
                )
                db.commit()

    return {"indexed": ok, "failed": failed, "errors": errors[:50]}

