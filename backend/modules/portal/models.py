import uuid
from sqlalchemy import Column, String, Text, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.sql import func
from backend.core.database import Base

class Announcement(Base):
    """Важное объявление для корпоративного портала"""

    __tablename__ = "announcements"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    image_color = Column(String(50), nullable=True, default="bg-blue-100")
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
