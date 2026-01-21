-- Миграция данных: Заполнение справочников начальными значениями
-- Переносит существующие TypeScript enum в таблицу dictionaries

-- Категории тикетов
INSERT INTO dictionaries (dictionary_type, key, label, color, sort_order, is_system) VALUES
  ('ticket_category', 'hardware', 'Оборудование', NULL, 1, true),
  ('ticket_category', 'software', 'Программное обеспечение', NULL, 2, true),
  ('ticket_category', 'network', 'Сеть', NULL, 3, true),
  ('ticket_category', 'hr', 'HR / Кадры', 'Заявки связанные с HR-процессами', 4, true),
  ('ticket_category', 'other', 'Прочее', NULL, 5, true)
ON CONFLICT (dictionary_type, key) DO NOTHING;

-- Приоритеты тикетов
INSERT INTO dictionaries (dictionary_type, key, label, color, sort_order, is_system) VALUES
  ('ticket_priority', 'low', 'Низкий', '#10b981', 1, true),
  ('ticket_priority', 'medium', 'Средний', '#3b82f6', 2, true),
  ('ticket_priority', 'high', 'Высокий', '#f59e0b', 3, true),
  ('ticket_priority', 'critical', 'Критический', '#ef4444', 4, true)
ON CONFLICT (dictionary_type, key) DO NOTHING;

-- Статусы тикетов
INSERT INTO dictionaries (dictionary_type, key, label, color, sort_order, is_system) VALUES
  ('ticket_status', 'new', 'Новая', '#3b82f6', 1, true),
  ('ticket_status', 'in_progress', 'В работе', '#f59e0b', 2, true),
  ('ticket_status', 'waiting', 'Ожидание', '#8b5cf6', 3, true),
  ('ticket_status', 'pending_user', 'Ожидает пользователя', '#ec4899', 4, true),
  ('ticket_status', 'resolved', 'Решена', '#10b981', 5, true),
  ('ticket_status', 'closed', 'Закрыта', '#6b7280', 6, true)
ON CONFLICT (dictionary_type, key) DO NOTHING;

-- Категории оборудования
INSERT INTO dictionaries (dictionary_type, key, label, color, sort_order, is_system) VALUES
  ('equipment_category', 'computer', 'Компьютер', NULL, 1, true),
  ('equipment_category', 'monitor', 'Монитор', NULL, 2, true),
  ('equipment_category', 'printer', 'Принтер', NULL, 3, true),
  ('equipment_category', 'network', 'Сетевое оборудование', NULL, 4, true),
  ('equipment_category', 'server', 'Сервер', NULL, 5, true),
  ('equipment_category', 'mobile', 'Мобильное устройство', NULL, 6, true),
  ('equipment_category', 'peripheral', 'Периферия', NULL, 7, true),
  ('equipment_category', 'other', 'Прочее', NULL, 8, true)
ON CONFLICT (dictionary_type, key) DO NOTHING;

-- Статусы оборудования
INSERT INTO dictionaries (dictionary_type, key, label, color, sort_order, is_system) VALUES
  ('equipment_status', 'in_use', 'В работе', '#10b981', 1, true),
  ('equipment_status', 'in_stock', 'На складе', '#3b82f6', 2, true),
  ('equipment_status', 'in_repair', 'В ремонте', '#f59e0b', 3, true),
  ('equipment_status', 'written_off', 'Списано', '#6b7280', 4, true)
ON CONFLICT (dictionary_type, key) DO NOTHING;

-- Типы расходников
INSERT INTO dictionaries (dictionary_type, key, label, color, sort_order, is_system) VALUES
  ('consumable_type', 'cartridge', 'Картридж', NULL, 1, true),
  ('consumable_type', 'drum', 'Фотобарабан', NULL, 2, true),
  ('consumable_type', 'toner', 'Тонер', NULL, 3, true),
  ('consumable_type', 'ink', 'Чернила', NULL, 4, true),
  ('consumable_type', 'paper', 'Бумага', NULL, 5, true),
  ('consumable_type', 'other', 'Прочее', NULL, 6, true)
ON CONFLICT (dictionary_type, key) DO NOTHING;

-- Email/SMTP/IMAP настройки (по умолчанию пустые, будут настроены через UI)
INSERT INTO system_settings (setting_key, setting_value, is_encrypted, setting_type, description) VALUES
  ('smtp_host', '', false, 'smtp', 'SMTP сервер'),
  ('smtp_port', '587', false, 'smtp', 'SMTP порт'),
  ('smtp_secure', 'false', false, 'smtp', 'Использовать SSL/TLS'),
  ('smtp_user', '', false, 'smtp', 'SMTP пользователь'),
  ('smtp_password', '', true, 'smtp', 'SMTP пароль'),
  ('from_email', '', false, 'email', 'Email отправителя'),
  ('from_name', 'SupporIT Support', false, 'email', 'Имя отправителя'),
  ('imap_enabled', 'false', false, 'imap', 'Включить IMAP'),
  ('imap_host', '', false, 'imap', 'IMAP сервер'),
  ('imap_port', '993', false, 'imap', 'IMAP порт'),
  ('imap_user', '', false, 'imap', 'IMAP пользователь'),
  ('imap_password', '', true, 'imap', 'IMAP пароль'),
  ('imap_tls', 'true', false, 'imap', 'Использовать TLS')
ON CONFLICT (setting_key) DO NOTHING;

-- Вывод статистики
DO $$
DECLARE
  dict_count INT;
  settings_count INT;
BEGIN
  SELECT COUNT(*) INTO dict_count FROM dictionaries;
  SELECT COUNT(*) INTO settings_count FROM system_settings;

  RAISE NOTICE 'Миграция данных завершена:';
  RAISE NOTICE '  - Справочников: %', dict_count;
  RAISE NOTICE '  - Настроек: %', settings_count;
END $$;
