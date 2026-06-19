"""Модель релиза платформы Elements (источник обновлений)."""
import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from ..database import Base


class Release(Base):
    __tablename__ = "releases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version = Column(String(32), nullable=False, index=True)
    edition = Column(String(32), nullable=False, default="core")
    channel = Column(String(16), nullable=False, default="stable")
    changelog = Column(Text, default="")
    download_url = Column(String(1024), nullable=False)
    sha256 = Column(String(64), nullable=False)
    signature = Column(Text, nullable=False)  # base64url(RSA-PSS-SHA256(metadata))
    min_required = Column(String(32), nullable=True)
    released_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    is_published = Column(Boolean, nullable=False, default=True)
