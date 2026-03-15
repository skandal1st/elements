from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime

class MailAccountCreate(BaseModel):
    """Создание учётки: логин и пароль обязательны; IMAP/SMTP задаются в Настройках."""
    login: str
    password: str
    email_address: Optional[EmailStr] = None  # для отображения (по умолчанию = login)
    display_name: Optional[str] = None
    # Серверные параметры опциональны — берутся из настроек интеграции с почтовым сервером
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_ssl: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_ssl: Optional[bool] = None

class MailAccountUpdate(BaseModel):
    display_name: Optional[str] = None
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_ssl: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_ssl: Optional[bool] = None
    login: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

class MailAccountResponse(BaseModel):
    id: UUID
    user_id: UUID
    email_address: Optional[str] = None
    display_name: Optional[str] = None
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_ssl: Optional[bool] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_ssl: Optional[bool] = None
    login: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class MailFolderResponse(BaseModel):
    name: str  # IMAP folder name for SELECT (e.g. INBOX, Sent)
    display_name: str  # Human-readable name for UI
    total: Optional[int] = None  # всего писем в папке
    unread: Optional[int] = None  # непрочитанных


class MailMessageResponse(BaseModel):
    id: str  # string representation of uid for list compatibility
    uid: int  # IMAP UID for fetching body and marking read
    subject: str
    sender: str
    date: str
    preview: str
    is_read: bool
    is_flagged: bool
    has_attachments: bool
    folder: str


class MailAttachmentDetail(BaseModel):
    filename: str
    content_type: str
    size: int


class MailMessageDetailResponse(BaseModel):
    uid: int
    subject: str
    sender: str
    date: str
    text_body: str
    html_body: str
    attachments: List[MailAttachmentDetail] = []

class MailSendRequest(BaseModel):
    to_emails: List[EmailStr] = Field(..., min_length=1, description="Минимум один получатель")
    subject: str
    text_body: str
    html_body: Optional[str] = None


class AddressbookEntry(BaseModel):
    email: str
    name: str
