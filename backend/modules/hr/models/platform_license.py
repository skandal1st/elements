"""
Модель платформенной офлайн-лицензии.

Лицензия — RSA-PSS-SHA256 подписанный ключ вида
    ELEM-LIC-v1.<base64url(payload)>.<base64url(signature)>
Публичный ключ для проверки — backend/core/license_pubkey.pem.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from backend.core.database import Base


class PlatformLicense(Base):
    __tablename__ = "platform_licenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Сам ключ и его метаданные (распакованные для удобства запросов)
    license_key = Column(Text, nullable=False)
    license_id = Column(String(64), nullable=False, index=True)
    customer_name = Column(String(255), nullable=False)
    edition = Column(String(32), nullable=False)
    modules = Column(JSONB, default=list)
    features = Column(JSONB, default=dict)
    max_users = Column(Integer, nullable=True)
    hardware_id = Column(String(128), nullable=True)
    issued_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    # Текущая активная лицензия (одна на инсталляцию)
    is_active = Column(Boolean, default=True, nullable=False)

    installed_at = Column(DateTime(timezone=True), server_default=func.now())
    installed_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    def __repr__(self) -> str:  # pragma: no cover - debug only
        return (
            f"<PlatformLicense id={self.id} edition={self.edition} "
            f"expires_at={self.expires_at} active={self.is_active}>"
        )

    @property
    def is_expired(self) -> bool:
        return self.expires_at < datetime.utcnow().replace(tzinfo=self.expires_at.tzinfo)
