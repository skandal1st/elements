-- Миграция: Добавление поддержки Telegram бота
-- Дата: 2026-01-05

-- 1. Добавляем поля для Telegram в таблицу users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_notifications BOOLEAN DEFAULT true;

-- 2. Индекс для быстрого поиска по telegram_id
CREATE INDEX IF NOT EXISTS idx_users_telegram_id
  ON users(telegram_id) WHERE telegram_id IS NOT NULL;

-- 3. Таблица для хранения одноразовых кодов привязки
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для таблицы кодов
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code
  ON telegram_link_codes(code) WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user
  ON telegram_link_codes(user_id);

-- 4. Функция для автоматической генерации QR-данных при создании оборудования
CREATE OR REPLACE FUNCTION generate_equipment_qr_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_code IS NULL THEN
    NEW.qr_code := json_build_object('type', 'equipment', 'id', NEW.id, 'v', 1)::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Триггер для автозаполнения qr_code
DROP TRIGGER IF EXISTS trigger_generate_equipment_qr ON equipment;
CREATE TRIGGER trigger_generate_equipment_qr
  BEFORE INSERT ON equipment
  FOR EACH ROW EXECUTE FUNCTION generate_equipment_qr_data();

-- 6. Обновление существующих записей оборудования без QR-кода
UPDATE equipment
SET qr_code = json_build_object('type', 'equipment', 'id', id, 'v', 1)::text
WHERE qr_code IS NULL;

-- Комментарии для документации
COMMENT ON COLUMN users.telegram_id IS 'Telegram user ID для уведомлений';
COMMENT ON COLUMN users.telegram_username IS 'Telegram username (@username)';
COMMENT ON COLUMN users.telegram_linked_at IS 'Дата и время привязки Telegram аккаунта';
COMMENT ON COLUMN users.telegram_notifications IS 'Флаг получения уведомлений в Telegram';
COMMENT ON COLUMN equipment.qr_code IS 'QR-код в формате JSON: {"type":"equipment","id":"uuid","v":1}';
