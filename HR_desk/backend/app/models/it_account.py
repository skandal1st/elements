from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class ITAccount(Base):
    __tablename__ = "it_accounts"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    ad_account = Column(String(128), nullable=True)
    mailcow_account = Column(String(128), nullable=True)
    messenger_account = Column(String(128), nullable=True)
    status = Column(String(32), nullable=False, default="active")

    employee = relationship("Employee")
