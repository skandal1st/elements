"""Схемы для маршрутов согласования."""
from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ApproverSchema(BaseModel):
    user_id: str
    name: str


class RouteStepSchema(BaseModel):
    order: int
    type: str = "sequential"
    name: str = ""
    approvers: List[ApproverSchema] = []
    deadline_hours: Optional[int] = 48


class ApprovalRouteCreate(BaseModel):
    name: str
    description: Optional[str] = None
    steps: List[RouteStepSchema] = []


class ApprovalRouteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[List[RouteStepSchema]] = None
    is_active: Optional[bool] = None


class ApprovalRouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    steps: List[Any] = []
    is_active: bool
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
