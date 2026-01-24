-- =============================================================================
-- Elements Platform - Инициализация базы данных
-- =============================================================================
-- Этот скрипт выполняется при первом запуске PostgreSQL
-- =============================================================================

-- Создаём схемы для модулей (изоляция таблиц)
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS it;
CREATE SCHEMA IF NOT EXISTS doc;

-- Даём права пользователю elements на все схемы
GRANT ALL ON SCHEMA hr TO elements;
GRANT ALL ON SCHEMA it TO elements;
GRANT ALL ON SCHEMA doc TO elements;
GRANT ALL ON SCHEMA public TO elements;

-- =============================================================================
-- Функция для обновления updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- Общая таблица пользователей (public schema)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(64) UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'it_specialist', 'hr_specialist', 'employee')),
    roles JSONB DEFAULT '{}',
    phone VARCHAR(32),
    department TEXT,
    position TEXT,
    avatar_url VARCHAR(512),
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_roles ON public.users USING GIN(roles);

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- IT Schema - SupporIT Tables
-- =============================================================================

-- Таблица зданий
CREATE TABLE IF NOT EXISTS it.buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    address TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buildings_active ON it.buildings(is_active);

-- Таблица оборудования
CREATE TABLE IF NOT EXISTS it.equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    model TEXT,
    inventory_number TEXT UNIQUE NOT NULL,
    serial_number TEXT,
    category TEXT NOT NULL CHECK (category IN ('computer', 'monitor', 'printer', 'network', 'server', 'mobile', 'peripheral', 'other')),
    status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_use', 'in_stock', 'in_repair', 'written_off')),
    purchase_date DATE,
    cost DECIMAL(10,2),
    warranty_until DATE,
    current_owner_id UUID REFERENCES public.users(id),
    location_department TEXT,
    location_room TEXT,
    manufacturer TEXT,
    ip_address TEXT,
    specifications JSONB,
    attachments TEXT[],
    qr_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_status ON it.equipment(status);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON it.equipment(category);
CREATE INDEX IF NOT EXISTS idx_equipment_owner ON it.equipment(current_owner_id);

-- Таблица истории перемещений оборудования
CREATE TABLE IF NOT EXISTS it.equipment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES it.equipment(id) ON DELETE CASCADE,
    from_user_id UUID REFERENCES public.users(id),
    to_user_id UUID REFERENCES public.users(id),
    from_location TEXT,
    to_location TEXT,
    reason TEXT,
    changed_by_id UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_history_equipment ON it.equipment_history(equipment_id);

-- Таблица заявок
CREATE TABLE IF NOT EXISTS it.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('hardware', 'software', 'network', 'hr', 'other')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'waiting', 'resolved', 'closed')),
    creator_id UUID NOT NULL REFERENCES public.users(id),
    assignee_id UUID REFERENCES public.users(id),
    equipment_id UUID REFERENCES it.equipment(id),
    attachments TEXT[],
    desired_resolution_date TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    rating_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON it.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_creator ON it.tickets(creator_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON it.tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON it.tickets(priority);

-- Таблица комментариев к заявкам
CREATE TABLE IF NOT EXISTS it.ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES it.tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    content TEXT NOT NULL,
    attachments TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON it.ticket_comments(ticket_id);

-- Таблица истории заявок
CREATE TABLE IF NOT EXISTS it.ticket_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES it.tickets(id) ON DELETE CASCADE,
    changed_by_id UUID NOT NULL REFERENCES public.users(id),
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица расходных материалов
CREATE TABLE IF NOT EXISTS it.consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    model TEXT,
    unit TEXT NOT NULL DEFAULT 'шт',
    quantity_in_stock INTEGER NOT NULL DEFAULT 0,
    min_quantity INTEGER NOT NULL DEFAULT 0,
    cost_per_unit DECIMAL(10,2),
    supplier TEXT,
    last_purchase_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица выдачи расходников
CREATE TABLE IF NOT EXISTS it.consumable_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumable_id UUID NOT NULL REFERENCES it.consumables(id),
    quantity INTEGER NOT NULL,
    issued_to_id UUID NOT NULL REFERENCES public.users(id),
    issued_by_id UUID NOT NULL REFERENCES public.users(id),
    reason TEXT,
    ticket_id UUID REFERENCES it.tickets(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица поставок расходников
CREATE TABLE IF NOT EXISTS it.consumable_supplies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumable_id UUID NOT NULL REFERENCES it.consumables(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    cost DECIMAL(12,2),
    supplier TEXT,
    invoice_number VARCHAR(100),
    supply_date DATE,
    notes TEXT,
    created_by_id UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumable_supplies_consumable ON it.consumable_supplies(consumable_id);
CREATE INDEX IF NOT EXISTS idx_consumable_supplies_date ON it.consumable_supplies(supply_date);

-- Таблица лицензий ПО
CREATE TABLE IF NOT EXISTS it.software_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    software_name TEXT NOT NULL,
    vendor TEXT,
    license_type TEXT,
    license_key TEXT,
    total_licenses INTEGER NOT NULL DEFAULT 1,
    used_licenses INTEGER NOT NULL DEFAULT 0,
    expires_at DATE,
    cost DECIMAL(10,2),
    purchase_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица привязки лицензий
CREATE TABLE IF NOT EXISTS it.license_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES it.software_licenses(id) ON DELETE CASCADE,
    equipment_id UUID REFERENCES it.equipment(id),
    user_id UUID REFERENCES public.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    released_at TIMESTAMPTZ
);

-- Таблица уведомлений
CREATE TABLE IF NOT EXISTS it.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')),
    related_type TEXT,
    related_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON it.notifications(user_id, is_read);

-- Таблица настроек системы
CREATE TABLE IF NOT EXISTS it.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица заявок на оборудование
CREATE TABLE IF NOT EXISTS it.equipment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.users(id),
    equipment_type TEXT NOT NULL,
    justification TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
    reviewer_id UUID REFERENCES public.users(id),
    review_comment TEXT,
    reviewed_at TIMESTAMPTZ,
    fulfilled_equipment_id UUID REFERENCES it.equipment(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram settings
CREATE TABLE IF NOT EXISTS it.telegram_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.users(id),
    is_verified BOOLEAN DEFAULT false,
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Триггеры для IT схемы
CREATE OR REPLACE TRIGGER update_buildings_updated_at BEFORE UPDATE ON it.buildings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_equipment_updated_at BEFORE UPDATE ON it.equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_tickets_updated_at BEFORE UPDATE ON it.tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_consumables_updated_at BEFORE UPDATE ON it.consumables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_software_licenses_updated_at BEFORE UPDATE ON it.software_licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_settings_updated_at BEFORE UPDATE ON it.settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_equipment_requests_updated_at BEFORE UPDATE ON it.equipment_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- HR Schema - HR_desk Tables
-- =============================================================================

-- Таблица отделов
CREATE TABLE IF NOT EXISTS hr.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    parent_id UUID REFERENCES hr.departments(id),
    manager_id UUID,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица должностей
CREATE TABLE IF NOT EXISTS hr.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    department_id UUID REFERENCES hr.departments(id),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица сотрудников
CREATE TABLE IF NOT EXISTS hr.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    personnel_number VARCHAR(50) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    birth_date DATE,
    hire_date DATE,
    department_id UUID REFERENCES hr.departments(id),
    position_id UUID REFERENCES hr.positions(id),
    manager_id UUID REFERENCES hr.employees(id),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile_phone VARCHAR(50),
    photo_url TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'dismissed')),
    dismissal_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица HR заявок
CREATE TABLE IF NOT EXISTS hr.requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('onboarding', 'offboarding', 'transfer', 'equipment', 'access')),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'pending_approval', 'approved', 'rejected', 'completed', 'cancelled')),
    employee_id UUID REFERENCES hr.employees(id),
    requester_id UUID REFERENCES public.users(id),
    assignee_id UUID REFERENCES public.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    data JSONB DEFAULT '{}',
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица аудит-логов
CREATE TABLE IF NOT EXISTS hr.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Настройки HR системы
CREATE TABLE IF NOT EXISTS hr.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- IT аккаунты сотрудников
CREATE TABLE IF NOT EXISTS hr.it_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hr.employees(id),
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('ad', 'email', 'vpn', 'other')),
    username VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Оборудование сотрудников (HR view)
CREATE TABLE IF NOT EXISTS hr.employee_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hr.employees(id),
    equipment_id UUID,  -- Reference to it.equipment
    equipment_name VARCHAR(255) NOT NULL,
    equipment_type VARCHAR(100),
    serial_number VARCHAR(255),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    notes TEXT
);

-- Индексы для HR
CREATE INDEX IF NOT EXISTS idx_employees_department ON hr.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON hr.employees(status);
CREATE INDEX IF NOT EXISTS idx_requests_status ON hr.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_type ON hr.requests(type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON hr.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON hr.audit_logs(entity_type, entity_id);

-- Триггеры для HR схемы
CREATE OR REPLACE TRIGGER update_departments_updated_at BEFORE UPDATE ON hr.departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_positions_updated_at BEFORE UPDATE ON hr.positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_employees_updated_at BEFORE UPDATE ON hr.employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_requests_updated_at BEFORE UPDATE ON hr.requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_hr_settings_updated_at BEFORE UPDATE ON hr.settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_it_accounts_updated_at BEFORE UPDATE ON hr.it_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Информационное сообщение
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Elements database initialized successfully!';
    RAISE NOTICE 'Schemas created: public, hr, it, doc';
END $$;
