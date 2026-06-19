from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class VersionOut(BaseModel):
    version: str
    build: str = ""


class UpdateCheckOut(BaseModel):
    latest: str
    current: str
    available: bool
    changelog: str = ""
    released_at: Optional[str] = None
    download_url: Optional[str] = None
    sha256: Optional[str] = None
    min_required: Optional[str] = None
    signature_valid: bool = False


class InstallUpdateIn(BaseModel):
    version: str


class UpdateTaskOut(BaseModel):
    id: UUID
    requested_version: str
    current_version: str
    status: str
    progress_percent: int
    log: str = ""
    error: Optional[str] = None
    backup_path: Optional[str] = None
    requested_by_id: Optional[UUID] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskStatusUpdateIn(BaseModel):
    """Внутренний эндпоинт — обновление статуса задачи из watchdog."""
    status: str
    progress_percent: Optional[int] = None
    log_append: Optional[str] = None
    error: Optional[str] = None
    backup_path: Optional[str] = None
