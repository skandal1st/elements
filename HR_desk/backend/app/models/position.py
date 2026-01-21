from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    access_template = Column(String(255), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    external_id = Column(String(128), nullable=True, unique=True, index=True)  # ID из 1С ЗУП

    department = relationship("Department", foreign_keys=[department_id])
