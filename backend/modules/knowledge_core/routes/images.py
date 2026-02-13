"""Upload images for knowledge articles."""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from backend.modules.it.dependencies import require_it_roles

router = APIRouter(prefix="/articles/images", tags=["knowledge"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB
EXT_MAP = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads/tickets")).parent / "knowledge"


@router.post(
    "/upload",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый тип файла: {file.content_type}. Разрешены: JPEG, PNG, GIF, WebP",
        )

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 10 МБ)")

    ext = EXT_MAP.get(file.content_type, "bin")
    filename = f"{uuid.uuid4().hex}.{ext}"

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOAD_DIR / filename
    dest.write_bytes(data)

    return {"url": f"/uploads/knowledge/{filename}", "filename": filename}
