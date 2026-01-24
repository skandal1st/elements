from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.core.database import Base


class HREquipment(Base):
    """HR-оборудование (привязка к сотруднику). Отдельно от IT equipment."""
    __tablename__ = "hr_equipment"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(128), nullable=False)
    serial_number = Column(String(128), nullable=False)
    status = Column(String(32), nullable=False, default="in_use")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)

    employee = relationship("Employee")
