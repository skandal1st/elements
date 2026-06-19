"""Эндпоинты центра обновлений для платформы Elements.

GET /api/v1/updates/latest?current=1.0.0&edition=core&channel=stable
    Возвращает информацию о последнем релизе.

Метаданные подписываются RSA-ключом вендора (та же пара, что используется
для лицензий) и проверяются на стороне платформы.
"""
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Release

router = APIRouter(prefix="/updates", tags=["updates"])

_VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$")


def _parse_version(v: str) -> tuple[int, int, int]:
    m = _VERSION_RE.match(v.strip())
    if not m:
        raise HTTPException(status_code=400, detail=f"Неверный формат версии: {v}")
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


@router.get("/latest")
def latest_release(
    current: str = Query(..., description="Текущая версия инсталляции"),
    edition: str = Query("core"),
    channel: str = Query("stable"),
    db: Session = Depends(get_db),
) -> dict:
    """Возвращает информацию о последней доступной версии для указанной редакции/канала."""
    current_tuple = _parse_version(current)

    candidates = (
        db.query(Release)
        .filter(
            Release.edition == edition,
            Release.channel == channel,
            Release.is_published == True,  # noqa: E712
        )
        .all()
    )

    if not candidates:
        return {
            "latest": current,
            "available": False,
            "changelog": "",
            "released_at": None,
            "download_url": None,
            "sha256": None,
            "signature": None,
            "min_required": None,
        }

    candidates.sort(key=lambda r: _parse_version(r.version), reverse=True)
    latest = candidates[0]
    latest_tuple = _parse_version(latest.version)

    return {
        "latest": latest.version,
        "available": latest_tuple > current_tuple,
        "current": current,
        "changelog": latest.changelog or "",
        "released_at": latest.released_at.isoformat() if latest.released_at else None,
        "download_url": latest.download_url,
        "sha256": latest.sha256,
        "signature": latest.signature,
        "min_required": latest.min_required,
        "edition": latest.edition,
        "channel": latest.channel,
    }


@router.get("/list")
def list_releases(
    edition: Optional[str] = None,
    channel: Optional[str] = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    q = db.query(Release).filter(Release.is_published == True)  # noqa: E712
    if edition:
        q = q.filter(Release.edition == edition)
    if channel:
        q = q.filter(Release.channel == channel)
    rows = q.order_by(Release.released_at.desc()).all()
    return [
        {
            "id": str(r.id),
            "version": r.version,
            "edition": r.edition,
            "channel": r.channel,
            "released_at": r.released_at.isoformat() if r.released_at else None,
            "min_required": r.min_required,
        }
        for r in rows
    ]
