"""
Company schemas for License Server
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


class CompanyCreate(BaseModel):
    """Request to create a new company"""
    name: str
    email: EmailStr
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None


class CompanyResponse(BaseModel):
    """Company information response"""
    id: UUID
    name: str
    email: str
    contact_name: Optional[str]
    contact_email: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class CompanyUpdate(BaseModel):
    """Update company"""
    name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    status: Optional[str] = None
