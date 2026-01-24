/**
 * Event schemas for Elements Platform
 */

/**
 * Standard event types for Elements Platform
 */
export enum EventType {
  // HR Module Events
  HR_EMPLOYEE_CREATED = 'hr.employee.created',
  HR_EMPLOYEE_UPDATED = 'hr.employee.updated',
  HR_EMPLOYEE_TERMINATED = 'hr.employee.terminated',
  HR_DEPARTMENT_CREATED = 'hr.department.created',
  HR_DEPARTMENT_UPDATED = 'hr.department.updated',
  HR_REQUEST_CREATED = 'hr.request.created',
  HR_REQUEST_COMPLETED = 'hr.request.completed',

  // IT Module Events
  IT_TICKET_CREATED = 'it.ticket.created',
  IT_TICKET_ASSIGNED = 'it.ticket.assigned',
  IT_TICKET_RESOLVED = 'it.ticket.resolved',
  IT_TICKET_CLOSED = 'it.ticket.closed',
  IT_EQUIPMENT_ASSIGNED = 'it.equipment.assigned',
  IT_EQUIPMENT_RETURNED = 'it.equipment.returned',
  IT_ACCOUNT_CREATED = 'it.account.created',
  IT_ACCOUNT_DISABLED = 'it.account.disabled',
  IT_USER_CREATED = 'it.user.created',
  IT_USER_UPDATED = 'it.user.updated',

  // Finance Module Events
  FINANCE_TRANSACTION_CREATED = 'finance.transaction.created',
  FINANCE_BUDGET_APPROVED = 'finance.budget.approved',
  FINANCE_PAYROLL_CALCULATED = 'finance.payroll.calculated',
  FINANCE_PAYMENT_SCHEDULED = 'finance.payment.scheduled',
  FINANCE_PAYMENT_COMPLETED = 'finance.payment.completed',
}

/**
 * Base event schema for all Elements events
 */
export interface ElementsEvent {
  event_id: string;
  event_type: string;
  source_module: string;
  timestamp: string; // ISO 8601 format
  correlation_id: string;
  data: Record<string, unknown>;
}

/**
 * Data schema for hr.employee.created event
 */
export interface EmployeeCreatedData {
  employee_id: string;
  user_id: string;
  email: string;
  full_name: string;
  department?: string;
  position?: string;
  hire_date?: string;
  requires_it_setup: boolean;
  requested_by?: string;
}

/**
 * Data schema for hr.employee.terminated event
 */
export interface EmployeeTerminatedData {
  employee_id: string;
  user_id: string;
  email: string;
  full_name: string;
  termination_date: string;
  requires_it_cleanup: boolean;
  requires_final_payroll: boolean;
}

/**
 * Data schema for it.ticket.created event
 */
export interface TicketCreatedData {
  ticket_id: string;
  title: string;
  category: string;
  priority: string;
  creator_id?: string;
  related_employee_id?: string;
  ticket_type?: string; // onboarding, offboarding, regular
}

/**
 * Data schema for it.equipment.assigned event
 */
export interface EquipmentAssignedData {
  equipment_id: string;
  equipment_name: string;
  serial_number?: string;
  assigned_to_user_id: string;
  assigned_to_email: string;
  assigned_by?: string;
}
