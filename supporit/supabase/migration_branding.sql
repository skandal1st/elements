-- Миграция: Добавление настроек брендинга (заголовок и favicon)

-- Добавляем новый тип настроек 'branding' в проверку
-- Сначала удаляем старое ограничение, если оно существует
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'system_settings_setting_type_check'
    AND table_name = 'system_settings'
  ) THEN
    ALTER TABLE system_settings DROP CONSTRAINT system_settings_setting_type_check;
  END IF;
END $$;

-- Добавляем новое ограничение с типом 'branding'
ALTER TABLE system_settings
ADD CONSTRAINT system_settings_setting_type_check
CHECK (setting_type IN ('email', 'smtp', 'imap', 'general', 'branding'));

-- Добавляем настройки брендинга
INSERT INTO system_settings (setting_key, setting_value, is_encrypted, setting_type, description) VALUES
  ('site_title', 'SuppOrIT', false, 'branding', 'Заголовок сайта (отображается во вкладке браузера)'),
  ('site_favicon', '', false, 'branding', 'URL или путь к favicon')
ON CONFLICT (setting_key) DO NOTHING;

-- Вывод информации
DO $$
DECLARE
  branding_count INT;
BEGIN
  SELECT COUNT(*) INTO branding_count FROM system_settings WHERE setting_type = 'branding';
  RAISE NOTICE 'Миграция брендинга завершена: % настроек добавлено', branding_count;
END $$;
