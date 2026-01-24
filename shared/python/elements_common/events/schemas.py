"""Event schemas for Elements Platform."""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Standard event types for Elements Platform."""

    # HR Module Events
    HR_EMPLOYEE_CREATED = "hr.employee.created"
    HR_EMPLOYEE_UPDATED = "hr.employee.updated"
    HR_EMPLOYEE_TERMINATED = "hr.employee.terminated"
    HR_DEPARTMENT_CREATED = "hr.department.created"
    HR_DEPARTMENT_UPDATED = "hr.department.updated"
    HR_REQUEST_CREATED = "hr.request.created"
    HR_REQUEST_COMPLETED = "hr.request.completed"

    # IT Module Events
    IT_TICKET_CREATED = "it.ticket.created"
    IT_TICKET_ASSIGNED = "it.ticket.assigned"
    IT_TICKET_RESOLVED = "it.ticket.resolved"
    IT_TICKET_CLOSED = "it.ticket.closed"
    IT_EQUIPMENT_ASSIGNED = "it.equipment.assigned"
    IT_EQUIPMENT_RETURNED = "it.equipment.returned"
    IT_ACCOUNT_CREATED = "it.account.created"
    IT_ACCOUNT_DISABLED = "it.account.disabled"
    IT_USER_CREATED = "it.user.created"
    IT_USER_UPDATED = "it.user.updated"

    # Finance Module Events
    FINANCE_TRANSACTION_CREATED = "finance.transaction.created"
    FINANCE_BUDGET_APPROVED = "finance.budget.approved"
    FINANCE_PAYROLL_CALCULATED = "finance.payroll.calculated"
    FINANCE_PAYMENT_SCHEDULED = "finance.payment.scheduled"
    FINANCE_PAYMENT_COMPLETED = "finance.payment.completed"


class ElementsEvent(BaseModel):
    """Base event schema for all Elements events."""

    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str
    source_module: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    data: dict[str, Any]

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


# Specific event schemas for type safety


class EmployeeCreatedEvent(BaseModel):
    """Data schema for hr.employee.created event."""

    employee_id: str
    user_id: str
    email: str
    full_name: str
    department: str | None = None
    position: str | None = None
    hire_date: str | None = None
    requires_it_setup: bool = True
    requested_by: str | None = None


class EmployeeTerminatedEvent(BaseModel):
    """Data schema for hr.employee.terminated event."""

    employee_id: str
    user_id: str
    email: str
    full_name: str
    termination_date: str
    requires_it_cleanup: bool = True
    requires_final_payroll: bool = True


class TicketCreatedEvent(BaseModel):
    """Data schema for it.ticket.created event."""

    ticket_id: str
    title: str
    category: str
    priority: str
    creator_id: str | None = None
    related_employee_id: str | None = None
    ticket_type: str | None = None  # onboarding, offboarding, regular


class EquipmentAssignedEvent(BaseModel):
    """Data schema for it.equipment.assigned event."""

    equipment_id: str
    equipment_name: str
    serial_number: str | None = None
    assigned_to_user_id: str
    assigned_to_email: str
    assigned_by: str | None = None
