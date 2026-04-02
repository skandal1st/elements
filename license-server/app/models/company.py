"""
Company model for License Server
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from ..database import Base


class Company(Base):
    """Company (customer) model"""

    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    contact_name = Column(String(255))
    contact_email = Column(String(255))
    status = Column(String(20), default="active")  # active, suspended, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    licenses = relationship("License", back_populates="company", cascade="all, delete-orphan")
