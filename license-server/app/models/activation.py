"""
Activation log model for License Server
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import relationship

from ..database import Base


class Activation(Base):
    """Activation log model - tracks all license validation attempts"""

    __tablename__ = "activations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    license_id = Column(UUID(as_uuid=True), ForeignKey("licenses.id"), nullable=False)
    hardware_id = Column(String(255), nullable=False)
    instance_version = Column(String(50))
    ip_address = Column(INET)
    result = Column(String(20), nullable=False)  # success, failed, expired, revoked
    error_message = Column(Text)
    checked_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    license = relationship("License", back_populates="activations")
