import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text, BigInteger
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.core.database import Base

class MailAccount(Base):
    """Учетная запись электронной почты пользователя"""
    __tablename__ = "mail_accounts"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    email_address = Column(String(255), nullable=False)
    # Имя, которое будет отображаться у получателей
    display_name = Column(String(255), nullable=True)
    
    # Если не заданы — берутся из настроек «Интеграция с почтовым сервером» (раздел Настройки)
    imap_host = Column(String(255), nullable=True)
    imap_port = Column(Integer, default=993, nullable=True)
    imap_ssl = Column(Boolean, default=True, nullable=True)
    
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, default=465, nullable=True)
    smtp_ssl = Column(Boolean, default=True, nullable=True)
    
    login = Column(String(255), nullable=False)
    password = Column(String(512), nullable=False)  # В проде нужно шифровать Fernet
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User")
    messages = relationship("MailMessage", back_populates="account", cascade="all, delete-orphan")

class MailMessage(Base):
    """Письмо (кэш для быстрого поиска на фронтенде)"""
    __tablename__ = "mail_messages"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(PGUUID(as_uuid=True), ForeignKey("mail_accounts.id", ondelete="CASCADE"), nullable=False)
    
    # Идентификатор сообщения (Message-ID: <...>) из заголовков почты
    message_id = Column(String(255), nullable=False, index=True)
    thread_id = Column(String(255), nullable=True)
    
    folder = Column(String(100), default="INBOX")
    
    subject = Column(String(1024), nullable=True)
    sender_name = Column(String(255), nullable=True)
    sender_email = Column(String(255), nullable=True)
    
    # JSON-строки для хранения списка словарей [{'name': '...', 'email': '...'}, ...]
    to_recipients = Column(Text, nullable=True)
    cc_recipients = Column(Text, nullable=True)
    
    # Короткий текст (превью)
    preview = Column(Text, nullable=True)
    
    # Внутренности
    html_body = Column(Text, nullable=True)
    text_body = Column(Text, nullable=True)
    
    # Флаги
    is_read = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    has_attachments = Column(Boolean, default=False)
    
    date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("MailAccount", back_populates="messages")
    attachments = relationship("MailAttachment", back_populates="message", cascade="all, delete-orphan")

class MailAttachment(Base):
    """Вложение письма"""
    __tablename__ = "mail_attachments"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(PGUUID(as_uuid=True), ForeignKey("mail_messages.id", ondelete="CASCADE"), nullable=False)
    
    filename = Column(String(512), nullable=False)
    content_type = Column(String(255), nullable=True)
    file_size = Column(BigInteger, default=0)
    
    # Путь к файлу в S3 / локальном хранилище, если скачан
    file_path = Column(String(512), nullable=True)
    
    message = relationship("MailMessage", back_populates="attachments")
