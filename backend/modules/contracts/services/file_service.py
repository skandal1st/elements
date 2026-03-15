"""Сохранение файлов договоров (PDF, DOC, DOCX)."""
import os
import uuid
from pathlib import Path

from fastapi import UploadFile, HTTPException

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads/tickets")).parent / "documents" / "contracts"
CONTRACTS_UPLOAD_PREFIX = "/uploads/documents/contracts"

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


async def save_contract_file(
    file: UploadFile,
    *,
    kind: str,  # "contract" | "act"
) -> dict:
    """Сохраняет файл договора или акта. Разрешает только PDF, DOC, DOCX."""
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 50 МБ)")

    ext = ""
    if file.filename and "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Разрешены только форматы: PDF, DOC, DOCX. Получен: {ext or 'неизвестный'}",
        )

    subfolder = "contracts" if kind == "contract" else "acts"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = UPLOAD_DIR / subfolder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / unique_name
    dest.write_bytes(data)

    return {
        "file_path": f"{CONTRACTS_UPLOAD_PREFIX}/{subfolder}/{unique_name}",
        "file_name": file.filename or unique_name,
    }
