"""Эндпоинты центра обновлений платформы."""
from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.core.license import redis_client
from backend.core.platform_license import load_public_key
from backend.core.version import BUILD, VERSION
from backend.modules.hr.dependencies import (
    get_current_user,
    get_db,
    require_owner,
    require_superuser,
)
from backend.modules.hr.models.user import User
from backend.modules.hr.services.audit import log_action
from backend.modules.platform.models.update_task import UpdateTask
from backend.modules.platform.schemas.updates import (
    InstallUpdateIn,
    TaskStatusUpdateIn,
    UpdateCheckOut,
    UpdateTaskOut,
    VersionOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/updates", tags=["platform-updates"])

REDIS_QUEUE_KEY = "elements:updates:queue"
CACHE_KEY = "platform:updates:latest"


# -------------------- helpers --------------------


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _verify_update_signature(metadata: dict, signature_b64: str) -> bool:
    """Проверяет подпись метаданных релиза тем же RSA-ключом, что и лицензии."""
    if not signature_b64:
        return False
    try:
        sig = _b64url_decode(signature_b64)
    except Exception:
        return False

    signed_fields = {
        "version": metadata.get("latest"),
        "edition": metadata.get("edition"),
        "channel": metadata.get("channel"),
        "sha256": metadata.get("sha256"),
        "released_at": metadata.get("released_at"),
        "min_required": metadata.get("min_required"),
    }
    payload = json.dumps(signed_fields, sort_keys=True, separators=(",", ":")).encode("utf-8")

    try:
        load_public_key().verify(
            sig,
            payload,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
            hashes.SHA256(),
        )
        return True
    except InvalidSignature:
        return False
    except Exception as exc:
        logger.warning("update signature verification skipped: %s", exc)
        return False


def _internal_token_guard(x_internal_token: str = Header(default="")) -> None:
    expected = (getattr(settings, "internal_update_token", "") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="INTERNAL_UPDATE_TOKEN не настроен")
    if not x_internal_token or x_internal_token.strip() != expected:
        raise HTTPException(status_code=401, detail="Неверный внутренний токен")


# -------------------- endpoints --------------------


@router.get("/current", response_model=VersionOut)
def current_version(_: User = Depends(get_current_user)) -> dict:
    return {"version": VERSION, "build": BUILD}


@router.get("/check", response_model=UpdateCheckOut)
async def check_for_updates(_: User = Depends(require_superuser)) -> dict:
    if not settings.update_server_url:
        raise HTTPException(status_code=503, detail="UPDATE_SERVER_URL не настроен")

    # Кэш Redis
    cached = None
    if redis_client is not None:
        try:
            raw = redis_client.get(CACHE_KEY)
            if raw:
                cached = json.loads(raw)
        except Exception:
            cached = None

    if cached:
        return cached

    url = f"{settings.update_server_url.rstrip('/')}/api/v1/updates/latest"
    params = {
        "current": VERSION,
        "edition": "core",
        "channel": settings.update_channel or "stable",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Update server недоступен: {exc}")

    signature_valid = _verify_update_signature(data, data.get("signature") or "")

    out = {
        "latest": data.get("latest") or VERSION,
        "current": VERSION,
        "available": bool(data.get("available")),
        "changelog": data.get("changelog") or "",
        "released_at": data.get("released_at"),
        "download_url": data.get("download_url"),
        "sha256": data.get("sha256"),
        "min_required": data.get("min_required"),
        "signature_valid": signature_valid,
    }

    if redis_client is not None:
        try:
            redis_client.setex(CACHE_KEY, settings.update_check_cache_ttl or 3600, json.dumps(out))
        except Exception:
            pass

    return out


@router.post("/install", response_model=UpdateTaskOut)
async def install_update(
    payload: InstallUpdateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> UpdateTask:
    if not settings.update_server_url:
        raise HTTPException(status_code=503, detail="UPDATE_SERVER_URL не настроен")

    # Проверка лицензии
    from backend.core.platform_license import get_license_status

    license_status = get_license_status(db)
    if not license_status["valid"]:
        raise HTTPException(
            status_code=400,
            detail="Невозможно установить обновление: лицензия не активна",
        )

    # Нет ли активных задач
    busy = (
        db.query(UpdateTask)
        .filter(
            UpdateTask.status.in_(
                ("queued", "running", "backing_up", "pulling", "building", "migrating")
            )
        )
        .first()
    )
    if busy:
        raise HTTPException(
            status_code=409,
            detail=f"Активная задача обновления уже выполняется (id={busy.id}, статус={busy.status})",
        )

    # Перепроверка доступной версии у update-server
    check_url = f"{settings.update_server_url.rstrip('/')}/api/v1/updates/latest"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                check_url,
                params={
                    "current": VERSION,
                    "edition": "core",
                    "channel": settings.update_channel or "stable",
                },
            )
            resp.raise_for_status()
            release = resp.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Update server недоступен: {exc}")

    if (release.get("latest") or "") != payload.version:
        raise HTTPException(
            status_code=400,
            detail=f"Требуемая версия {payload.version} больше не актуальна (есть {release.get('latest')})",
        )

    if not _verify_update_signature(release, release.get("signature") or ""):
        raise HTTPException(status_code=400, detail="Подпись метаданных релиза не прошла проверку")

    task = UpdateTask(
        requested_version=payload.version,
        current_version=VERSION,
        status="queued",
        progress_percent=0,
        log="Задача поставлена в очередь\n",
        requested_by_id=current_user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    queue_payload = {
        "task_id": str(task.id),
        "version": payload.version,
        "download_url": release.get("download_url"),
        "sha256": release.get("sha256"),
    }

    if redis_client is None:
        task.status = "failed"
        task.error = "Redis недоступен — watchdog не сможет получить задачу"
        db.commit()
        db.refresh(task)
        raise HTTPException(status_code=503, detail=task.error)

    try:
        redis_client.lpush(REDIS_QUEUE_KEY, json.dumps(queue_payload))
    except Exception as exc:
        task.status = "failed"
        task.error = f"Не удалось поставить задачу в очередь Redis: {exc}"
        db.commit()
        db.refresh(task)
        raise HTTPException(status_code=503, detail=task.error)

    log_action(
        db,
        current_user.username or current_user.email,
        "update_install_requested",
        "update_task",
        f"id={task.id}, version={payload.version}",
    )
    return task


@router.get("/tasks", response_model=List[UpdateTaskOut])
def list_tasks(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
    limit: int = 20,
) -> List[UpdateTask]:
    return (
        db.query(UpdateTask)
        .order_by(UpdateTask.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )


@router.get("/tasks/{task_id}", response_model=UpdateTaskOut)
def get_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
) -> UpdateTask:
    task = db.query(UpdateTask).filter(UpdateTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return task


@router.post("/tasks/{task_id}/cancel", response_model=UpdateTaskOut)
def cancel_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
) -> UpdateTask:
    task = db.query(UpdateTask).filter(UpdateTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if task.status != "queued":
        raise HTTPException(
            status_code=400,
            detail=f"Отменить можно только задачу в статусе 'queued' (текущий: {task.status})",
        )

    task.status = "cancelled"
    task.finished_at = datetime.now(timezone.utc)
    task.log = (task.log or "") + "Отменено пользователем\n"
    db.commit()
    db.refresh(task)

    log_action(
        db,
        current_user.username or current_user.email,
        "update_cancelled",
        "update_task",
        f"id={task.id}",
    )
    return task


@router.post(
    "/internal/tasks/{task_id}/status",
    response_model=UpdateTaskOut,
    dependencies=[Depends(_internal_token_guard)],
)
def update_task_status(
    task_id: UUID,
    payload: TaskStatusUpdateIn,
    db: Session = Depends(get_db),
) -> UpdateTask:
    """Внутренний эндпоинт для watchdog: обновляет статус задачи."""
    task = db.query(UpdateTask).filter(UpdateTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    prev_status = task.status
    task.status = payload.status
    if payload.progress_percent is not None:
        task.progress_percent = max(0, min(100, int(payload.progress_percent)))
    if payload.log_append:
        task.log = (task.log or "") + payload.log_append
        if not payload.log_append.endswith("\n"):
            task.log += "\n"
    if payload.error is not None:
        task.error = payload.error
    if payload.backup_path is not None:
        task.backup_path = payload.backup_path

    if prev_status == "queued" and payload.status != "queued" and task.started_at is None:
        task.started_at = datetime.now(timezone.utc)
    if payload.status in ("done", "failed", "rolled_back", "cancelled") and task.finished_at is None:
        task.finished_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(task)
    return task
