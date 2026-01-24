from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user: str = Field(validation_alias="user_name")
    action: str
    entity: str
    timestamp: datetime = Field(validation_alias="created_at")
    details: Optional[str] = None
