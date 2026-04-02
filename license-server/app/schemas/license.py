"""
License schemas for License Server
"""

from datetime import datetime
from typing import List, Optional, Dict
from uuid import UUID
from pydantic import BaseModel, Field


class LicenseValidateRequest(BaseModel):
    """Request to validate a license"""
    company_id: UUID
    hardware_id: str
    edition: str  # core or enterprise
    version: Optional[str] = "1.0.0"


class LicenseValidateResponse(BaseModel):
    """Response from license validation"""
    valid: bool
    edition: Optional[str] = None
    expires_at: Optional[datetime] = None
    modules: Optional[List[str]] = None
    max_users: Optional[int] = None
    features: Optional[Dict[str, bool]] = None
    error: Optional[str] = None


class LicenseModulesResponse(BaseModel):
    """Response with available modules"""
    modules: List[str]
    expires_at: datetime


class LicenseCreate(BaseModel):
    """Request to create a new license"""
    company_id: UUID
    edition: str = Field(..., pattern="^(core|enterprise)$")
    modules: List[str]
    features: Dict[str, bool] = {}
    max_users: Optional[int] = None
    max_instances: int = 1
    expires_at: datetime
    bind_hardware: bool = False
    allowed_hardware_ids: List[str] = []


class LicenseResponse(BaseModel):
    """License information response"""
    id: UUID
    company_id: UUID
    license_key: str
    edition: str
    modules: List[str]
    features: Dict[str, bool]
    max_users: Optional[int]
    max_instances: int
    issued_at: datetime
    expires_at: datetime
    status: str
    bind_hardware: bool

    class Config:
        from_attributes = True


class LicenseUpdate(BaseModel):
    """Update license"""
    expires_at: Optional[datetime] = None
    status: Optional[str] = None
    max_users: Optional[int] = None
    max_instances: Optional[int] = None
    allowed_hardware_ids: Optional[List[str]] = None
