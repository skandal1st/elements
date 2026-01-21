from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class HRRequest(Base):
    __tablename__ = "hr_requests"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(16), nullable=False)  # hire / fire
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    request_date = Column(Date, nullable=False)
    effective_date = Column(Date, nullable=True)
    status = Column(String(32), nullable=False, default="new")
    needs_it_equipment = Column(Boolean, default=False)
    pass_number = Column(String(64), nullable=True)

    employee = relationship("Employee")
