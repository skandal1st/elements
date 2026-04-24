from typing import Any, Optional
from pydantic import BaseModel


class RcLastMessage(BaseModel):
    id: Optional[str] = None
    text: Optional[str] = None
    sender_username: Optional[str] = None
    ts: Optional[str] = None


class RcRoom(BaseModel):
    id: str
    name: str
    display_name: str
    type: str  # c=channel, p=private, d=dm
    unread: int = 0
    alert: bool = False
    last_message: Optional[Any] = None


class RcMessage(BaseModel):
    id: str
    room_id: str
    text: str
    sender_name: str
    sender_username: str
    ts: Optional[str] = None
    attachments: list = []
    t: Optional[str] = None  # системный тип


class RcMessagesResponse(BaseModel):
    messages: list[RcMessage]
    total: int


class RcRoomsResponse(BaseModel):
    rooms: list[RcRoom]


class RcSubscription(BaseModel):
    room_id: str
    unread: int
    alert: bool


class SendMessageRequest(BaseModel):
    text: str


class RcChatUser(BaseModel):
    full_name: str
    email: Optional[str] = None
    rc_username: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None


class RcChatUsersResponse(BaseModel):
    departments: list[dict]  # [{id, name, users: [...]}]
    without_department: list[RcChatUser]


class DmCreateRequest(BaseModel):
    rc_username: str


class DmCreateResponse(BaseModel):
    room_id: str
    room_type: str = "d"
