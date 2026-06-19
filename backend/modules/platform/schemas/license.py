from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class LicenseInfo(BaseModel):
    id: str
    license_id: str
    customer_name: str
    edition: str
    modules: list[str] = []
    features: dict[str, Any] = {}
    max_users: Optional[int] = None
    hardware_id: Optional[str] = None
    issued_at: str
    expires_at: str
    installed_at: Optional[str] = None
    installed_by_id: Optional[str] = None


class LicenseStatusOut(BaseModel):
    valid: bool
    state: str  # valid | grace | expired | absent | invalid
    days_until_expiry: Optional[int] = None
    license: Optional[LicenseInfo] = None
    hardware_id: str


class LicenseInstallIn(BaseModel):
    license_key: str


class HardwareIdOut(BaseModel):
    hardware_id: str


class LicenseHistoryEntry(BaseModel):
    id: UUID
    license_id: str
    customer_name: str
    edition: str
    expires_at: datetime
    installed_at: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True
