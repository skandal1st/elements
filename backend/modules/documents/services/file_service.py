"""Сервис работы с файлами документов."""

import os
import uuid
from pathlib import Path

from fastapi import UploadFile

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads/tickets")).parent / "documents"

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


async def save_document_file(file: UploadFile, subfolder: str = "files") -> dict:
    """Сохраняет файл документа и возвращает метаданные."""
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise ValueError("Файл слишком большой (макс. 50 МБ)")

    ext = ""
    if file.filename and "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[1].lower()

    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = UPLOAD_DIR / subfolder
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / unique_name
    dest.write_bytes(data)

    return {
        "file_path": f"/uploads/documents/{subfolder}/{unique_name}",
        "file_name": file.filename or unique_name,
        "file_size": len(data),
        "mime_type": file.content_type,
    }


def get_absolute_path(relative_path: str) -> Path:
    """Преобразует относительный URL-путь в абсолютный путь на диске."""
    # relative_path: /uploads/documents/files/abc.docx
    # -> uploads/documents/files/abc.docx
    clean = relative_path.lstrip("/")
    return Path(clean)
