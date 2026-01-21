from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    user: str
    action: str
    entity: str
    timestamp: datetime
    details: Optional[str] = None

    class Config:
        from_attributes = True
