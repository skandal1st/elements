"""
License model for License Server
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from ..database import Base


class License(Base):
    """License model"""

    __tablename__ = "licenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    license_key = Column(String(255), unique=True, nullable=False)
    edition = Column(String(20), nullable=False)  # core, enterprise
    modules = Column(JSONB, default=list)  # ["hr", "it", "tasks"]
    features = Column(JSONB, default=dict)  # {"rocketchat": true}
    max_users = Column(Integer, nullable=True)  # NULL = unlimited
    max_instances = Column(Integer, default=1)
    issued_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    status = Column(String(20), default="active")  # active, expired, revoked
    bind_hardware = Column(Boolean, default=False)
    allowed_hardware_ids = Column(JSONB, default=list)  # ["hardware-id-1", "hardware-id-2"]

    # Relationships
    company = relationship("Company", back_populates="licenses")
    activations = relationship("Activation", back_populates="license", cascade="all, delete-orphan")
