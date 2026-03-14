from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime

class MailAccountCreate(BaseModel):
    email_address: EmailStr
    display_name: Optional[str] = None
    imap_host: str
    imap_port: int = 993
    imap_ssl: bool = True
    smtp_host: str
    smtp_port: int = 465
    smtp_ssl: bool = True
    login: str
    password: str

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
    email_address: str
    display_name: Optional[str] = None
    imap_host: str
    imap_port: int
    imap_ssl: bool
    smtp_host: str
    smtp_port: int
    smtp_ssl: bool
    login: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class MailFolderResponse(BaseModel):
    name: str  # IMAP folder name for SELECT (e.g. INBOX, Sent)
    display_name: str  # Human-readable name for UI


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


class MailMessageDetailResponse(BaseModel):
    uid: int
    subject: str
    sender: str
    date: str
    text_body: str
    html_body: str

class MailSendRequest(BaseModel):
    to_email: EmailStr
    subject: str
    text_body: str
    html_body: Optional[str] = None
