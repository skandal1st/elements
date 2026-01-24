"""Shared user schemas for Elements Platform."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    """Base user schema with common fields."""

    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: str = Field(min_length=6)
    roles: dict[str, str] = Field(default_factory=dict)
    is_superuser: bool = False


class UserUpdate(BaseModel):
    """Schema for updating user."""

    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    roles: Optional[dict[str, str]] = None
    is_active: Optional[bool] = None


class UserOut(UserBase):
    """Schema for user output."""

    id: UUID
    roles: dict[str, str] = Field(default_factory=dict)
    is_active: bool = True
    is_superuser: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class UserInToken(BaseModel):
    """Minimal user info stored in JWT."""

    id: UUID
    email: str
    roles: dict[str, str]
    is_superuser: bool = False
