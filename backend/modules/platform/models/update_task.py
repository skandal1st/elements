"""Модель задачи обновления платформы."""
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from backend.core.database import Base


# Возможные значения UpdateTask.status:
#   queued, running, backing_up, pulling, building, migrating,
#   done, failed, rolled_back, cancelled
class UpdateTask(Base):
    __tablename__ = "update_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requested_version = Column(String(32), nullable=False)
    current_version = Column(String(32), nullable=False)
    status = Column(String(20), nullable=False, default="queued")
    progress_percent = Column(Integer, default=0, nullable=False)
    log = Column(Text, default="")
    error = Column(Text, nullable=True)
    backup_path = Column(String(512), nullable=True)

    requested_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
