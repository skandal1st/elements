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
-- Общая таблица пользователей (public schema)
-- =============================================================================
-- Это единственная общая таблица для всех модулей
-- Каждый модуль использует её для аутентификации

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,

    -- Роли по модулям (JSONB для гибкости)
    -- Пример: {"hr": "admin", "it": "user", "doc": "editor"}
    roles JSONB DEFAULT '{}',

    -- Общие данные сотрудника
    phone VARCHAR(32),
    avatar_url VARCHAR(512),

    -- Статус
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,

    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Индексы для users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_roles ON public.users USING GIN(roles);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Информационное сообщение
-- =============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Elements database initialized successfully!';
    RAISE NOTICE 'Schemas created: public, hr, it, doc';
END $$;
