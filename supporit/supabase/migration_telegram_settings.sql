-- Миграция: Добавление настроек Telegram бота в system_settings
-- Дата: 2026-01-10

-- 1. Обновляем constraint для setting_type (добавляем 'telegram')
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS system_settings_setting_type_check;
ALTER TABLE system_settings ADD CONSTRAINT system_settings_setting_type_check
  CHECK (setting_type IN ('email', 'smtp', 'imap', 'general', 'telegram'));

-- 2. Добавляем настройки Telegram бота
INSERT INTO system_settings (setting_key, setting_value, is_encrypted, setting_type, description)
VALUES
  ('telegram_bot_token', NULL, true, 'telegram', 'Токен Telegram бота (получить у @BotFather)'),
  ('telegram_bot_username', NULL, false, 'telegram', 'Username бота без @ (например: MyCompanyBot)'),
  ('telegram_bot_enabled', 'false', false, 'telegram', 'Включить Telegram бота (true/false)')
ON CONFLICT (setting_key) DO NOTHING;

-- Комментарии
COMMENT ON COLUMN system_settings.setting_type IS 'Тип настройки: email, smtp, imap, general, telegram';
