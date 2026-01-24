from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.core.database import Base


class Employee(Base):
    """
    Сотрудник организации.
    Связан с общей таблицей users через user_id.
    """

    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    full_name = Column(String(255), nullable=False, index=True)
    position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    room_id = Column(PGUUID(as_uuid=True), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True)  # Кабинет сотрудника
    internal_phone = Column(String(32), nullable=True)
    external_phone = Column(String(32), nullable=True)
    email = Column(String(255), nullable=True)
    birthday = Column(Date, nullable=True)
    status = Column(String(32), nullable=False, default="candidate")
    uses_it_equipment = Column(Boolean, default=False)
    external_id = Column(String(128), nullable=True)
    pass_number = Column(String(64), nullable=True)

    # Метаданные
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    position = relationship("Position")
    department = relationship("Department", foreign_keys=[department_id])
    manager = relationship("Employee", remote_side=[id], foreign_keys=[manager_id])
    # room relationship - односторонняя связь, так как Room находится в другом модуле