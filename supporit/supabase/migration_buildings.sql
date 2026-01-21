-- Миграция для создания таблицы зданий

CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс для быстрого поиска активных зданий
CREATE INDEX IF NOT EXISTS idx_buildings_active ON buildings(is_active);

-- Функция для автоматического обновления updated_at (создаем, если еще не существует)
-- Используем CREATE OR REPLACE, так что если функция уже есть - просто обновим её
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_buildings_updated_at_trigger
  BEFORE UPDATE ON buildings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Комментарии для документации
COMMENT ON TABLE buildings IS 'Таблица зданий';
COMMENT ON COLUMN buildings.name IS 'Название здания (уникальное)';
COMMENT ON COLUMN buildings.address IS 'Адрес здания';
COMMENT ON COLUMN buildings.description IS 'Описание здания';
COMMENT ON COLUMN buildings.is_active IS 'Флаг активности здания';

