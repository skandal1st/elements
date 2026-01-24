from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SystemSettingOut(BaseModel):
    id: int
    setting_key: str
    setting_value: Optional[str]
    setting_type: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SystemSettingUpdate(BaseModel):
    value: str


class BrandingSettings(BaseModel):
    site_title: str
    site_favicon: str


class FaviconUploadResponse(BaseModel):
    url: str
