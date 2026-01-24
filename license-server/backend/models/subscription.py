"""
Модели для сервера лицензирования
"""
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Company(Base):
    """Модель компании"""
    __tablename__ = "companies"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), unique=True, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Связи
    subscriptions = relationship("Subscription", back_populates="company", cascade="all, delete-orphan")


class Module(Base):
    """Модель модуля платформы"""
    __tablename__ = "modules"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    code = Column(String(50), unique=True, nullable=False)  # hr, it, finance
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Связи
    subscription_modules = relationship("SubscriptionModule", back_populates="module")


class Subscription(Base):
    """Модель подписки компании"""
    __tablename__ = "subscriptions"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    company_id = Column(PGUUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    plan_name = Column(String(100), nullable=False)  # basic, professional, enterprise
    status = Column(String(50), default="active", nullable=False)  # active, suspended, cancelled
    starts_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    auto_renew = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Связи
    company = relationship("Company", back_populates="subscriptions")
    modules = relationship("SubscriptionModule", back_populates="subscription", cascade="all, delete-orphan")


class SubscriptionModule(Base):
    """Связь подписки с модулями (many-to-many)"""
    __tablename__ = "subscription_modules"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    subscription_id = Column(PGUUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False)
    module_id = Column(PGUUID(as_uuid=True), ForeignKey("modules.id"), nullable=False)
    features = Column(JSON, nullable=True)  # Дополнительные функции модуля
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Связи
    subscription = relationship("Subscription", back_populates="modules")
    module = relationship("Module", back_populates="subscription_modules")
