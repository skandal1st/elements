-- Миграция: Система настроек и справочников для SupporIT
-- Создает таблицы dictionaries и system_settings

-- Таблица универсальных справочников
CREATE TABLE IF NOT EXISTS dictionaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dictionary_type TEXT NOT NULL CHECK (dictionary_type IN (
    'ticket_category',
    'ticket_priority',
    'ticket_status',
    'equipment_category',
    'equipment_status',
    'consumable_type'
  )),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_dictionary_key UNIQUE (dictionary_type, key)
);

-- Таблица системных настроек
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  setting_type TEXT CHECK (setting_type IN ('email', 'smtp', 'imap', 'general')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_dictionaries_type ON dictionaries(dictionary_type);
CREATE INDEX IF NOT EXISTS idx_dictionaries_active ON dictionaries(is_active);
CREATE INDEX IF NOT EXISTS idx_dictionaries_type_active ON dictionaries(dictionary_type, is_active);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_type ON system_settings(setting_type);

-- Комментарии
COMMENT ON TABLE dictionaries IS 'Универсальная таблица справочников системы';
COMMENT ON TABLE system_settings IS 'Системные настройки (Email, SMTP и т.д.)';
COMMENT ON COLUMN dictionaries.key IS 'Уникальный ключ для использования в коде';
COMMENT ON COLUMN dictionaries.label IS 'Отображаемое название на русском языке';
COMMENT ON COLUMN dictionaries.is_system IS 'Системная запись - нельзя удалить или изменить ключ';
COMMENT ON COLUMN system_settings.is_encrypted IS 'Указывает, что значение зашифровано (для паролей)';

-- Функция для обновления updated_at (если еще не существует)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для updated_at
DROP TRIGGER IF EXISTS update_dictionaries_updated_at ON dictionaries;
CREATE TRIGGER update_dictionaries_updated_at
  BEFORE UPDATE ON dictionaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Примечание: RLS политики не используются, так как это не Supabase
-- Безопасность обеспечивается на уровне API через middleware authenticate и requireRole
