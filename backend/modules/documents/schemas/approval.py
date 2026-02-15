"""Схемы для процесса согласования."""
from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SubmitRequest(BaseModel):
    route_id: Optional[UUID] = None


class ApprovalDecisionRequest(BaseModel):
    comment: Optional[str] = None


class ApprovalStepInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    approval_instance_id: UUID
    step_order: int
    approver_id: UUID
    status: str
    decision_at: Optional[datetime] = None
    comment: Optional[str] = None
    deadline_at: Optional[datetime] = None
    carry_over: bool = False
    created_at: Optional[datetime] = None
    approver_name: Optional[str] = None


class ApprovalInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    route_id: Optional[UUID] = None
    route_snapshot: Optional[Any] = None
    status: str
    current_step_order: int
    attempt: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    step_instances: List[ApprovalStepInstanceOut] = []


class MyApprovalItem(BaseModel):
    document_id: UUID
    document_title: str
    document_status: str
    step_instance_id: UUID
    step_order: int
    deadline_at: Optional[datetime] = None
    document_creator_name: Optional[str] = None
