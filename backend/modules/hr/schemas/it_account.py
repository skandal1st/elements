from typing import Optional

from pydantic import BaseModel


class ITAccountBase(BaseModel):
    employee_id: int
    ad_account: Optional[str] = None
    mailcow_account: Optional[str] = None
    messenger_account: Optional[str] = None
    status: str = "active"


class ITAccountCreate(ITAccountBase):
    pass


class ITAccountUpdate(BaseModel):
    ad_account: Optional[str] = None
    mailcow_account: Optional[str] = None
    messenger_account: Optional[str] = None
    status: Optional[str] = None


class ITAccountOut(ITAccountBase):
    id: int

    class Config:
        from_attributes = True
