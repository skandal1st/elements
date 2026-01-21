-- Миграция: Система автоматического обновления
-- Версия: 1.0.0
-- Дата: 2026-01-06

-- ============================================
-- Таблица отслеживания миграций БД
-- ============================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  execution_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_version
  ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
  ON schema_migrations(applied_at DESC);

COMMENT ON TABLE schema_migrations IS 'Отслеживание примененных миграций БД';

-- ============================================
-- Таблица логов обновлений системы
-- ============================================
CREATE TABLE IF NOT EXISTS update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'started',
    'downloading',
    'backing_up',
    'migrating',
    'deploying',
    'completed',
    'failed',
    'rolled_back'
  )),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  performed_by UUID REFERENCES users(id),
  backup_path TEXT,
  error_message TEXT,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_update_logs_status
  ON update_logs(status);
CREATE INDEX IF NOT EXISTS idx_update_logs_started_at
  ON update_logs(started_at DESC);

COMMENT ON TABLE update_logs IS 'История обновлений системы';

-- ============================================
-- Таблица информации о системе (singleton)
-- ============================================
CREATE TABLE IF NOT EXISTS system_info (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_version TEXT NOT NULL DEFAULT '1.0.0',
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  last_update_at TIMESTAMPTZ,
  last_update_check TIMESTAMPTZ,
  license_key TEXT,
  license_valid_until TIMESTAMPTZ,
  license_type TEXT CHECK (license_type IN ('BASIC', 'PRO', 'ENTERPRISE') OR license_type IS NULL),
  instance_id UUID DEFAULT gen_random_uuid()
);

-- Инициализация system_info (singleton)
INSERT INTO system_info (id, current_version)
VALUES (1, '1.0.0')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE system_info IS 'Информация о текущей инсталляции (singleton)';
COMMENT ON COLUMN system_info.instance_id IS 'Уникальный идентификатор инсталляции для лицензирования';
COMMENT ON COLUMN system_info.license_key IS 'Зашифрованный лицензионный ключ';

-- ============================================
-- Триггер обновления updated_at для update_logs
-- ============================================
CREATE OR REPLACE FUNCTION update_logs_set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed', 'rolled_back') AND OLD.status != NEW.status THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_logs_completed ON update_logs;
CREATE TRIGGER trigger_update_logs_completed
  BEFORE UPDATE ON update_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_logs_set_completed_at();
