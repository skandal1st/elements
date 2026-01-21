-- Миграция: добавление категории HR для заявок
-- Дата: 2026-01-20

-- 1. Удаляем старый CHECK constraint на категорию тикетов
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_check;

-- 2. Добавляем новый CHECK constraint с категорией hr
ALTER TABLE tickets ADD CONSTRAINT tickets_category_check 
  CHECK (category IN ('hardware', 'software', 'network', 'hr', 'other'));

-- 3. Добавляем категорию hr в справочник настроек (если используется)
INSERT INTO dictionary_values (dictionary_type, value, label, description, sort_order, is_active)
VALUES ('ticket_category', 'hr', 'HR / Кадры', 'Заявки связанные с HR-процессами', 4, true)
ON CONFLICT (dictionary_type, value) DO NOTHING;

-- 4. Обновляем sort_order для "other", чтобы hr была перед ней
UPDATE dictionary_values 
SET sort_order = 5 
WHERE dictionary_type = 'ticket_category' AND value = 'other';
