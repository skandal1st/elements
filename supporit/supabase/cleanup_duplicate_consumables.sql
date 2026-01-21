-- Скрипт для удаления дубликатов расходников
-- Оставляет самый старый расходник, переносит все связи на него

BEGIN;

-- Для каждой группы дубликатов (по model + name):
-- 1. Находим самый старый расходник (keeper)
-- 2. Переносим все equipment_consumables на keeper
-- 3. Удаляем дубликаты

-- Создаем временную таблицу с информацией о дубликатах
CREATE TEMP TABLE duplicate_consumables AS
SELECT
  id,
  name,
  model,
  created_at,
  ROW_NUMBER() OVER (PARTITION BY name, model ORDER BY created_at ASC) as rn,
  FIRST_VALUE(id) OVER (PARTITION BY name, model ORDER BY created_at ASC) as keeper_id
FROM consumables
WHERE (name, model) IN (
  SELECT name, model
  FROM consumables
  GROUP BY name, model
  HAVING COUNT(*) > 1
);

-- Показываем, что будет сделано
SELECT
  'KEEPER' as status,
  id,
  name,
  model,
  created_at
FROM duplicate_consumables
WHERE rn = 1
ORDER BY name, model;

SELECT
  'WILL DELETE' as status,
  id,
  name,
  model,
  created_at
FROM duplicate_consumables
WHERE rn > 1
ORDER BY name, model, created_at;

-- Переносим все equipment_consumables связи на keeper
UPDATE equipment_consumables ec
SET consumable_id = dc.keeper_id
FROM duplicate_consumables dc
WHERE ec.consumable_id = dc.id
  AND dc.rn > 1
  AND NOT EXISTS (
    -- Проверяем, что связь equipment_id + keeper_id еще не существует
    SELECT 1
    FROM equipment_consumables ec2
    WHERE ec2.equipment_id = ec.equipment_id
      AND ec2.consumable_id = dc.keeper_id
  );

-- Удаляем дублирующиеся связи (если equipment уже связан с keeper)
DELETE FROM equipment_consumables ec
USING duplicate_consumables dc
WHERE ec.consumable_id = dc.id
  AND dc.rn > 1
  AND EXISTS (
    SELECT 1
    FROM equipment_consumables ec2
    WHERE ec2.equipment_id = ec.equipment_id
      AND ec2.consumable_id = dc.keeper_id
  );

-- Переносим все ticket_consumables связи (если есть)
UPDATE ticket_consumables tc
SET consumable_id = dc.keeper_id
FROM duplicate_consumables dc
WHERE tc.consumable_id = dc.id
  AND dc.rn > 1
  AND NOT EXISTS (
    SELECT 1
    FROM ticket_consumables tc2
    WHERE tc2.ticket_id = tc.ticket_id
      AND tc2.consumable_id = dc.keeper_id
  );

-- Удаляем дублирующиеся ticket связи
DELETE FROM ticket_consumables tc
USING duplicate_consumables dc
WHERE tc.consumable_id = dc.id
  AND dc.rn > 1
  AND EXISTS (
    SELECT 1
    FROM ticket_consumables tc2
    WHERE tc2.ticket_id = tc.ticket_id
      AND tc2.consumable_id = dc.keeper_id
  );

-- Переносим все consumable_issues связи
UPDATE consumable_issues ci
SET consumable_id = dc.keeper_id
FROM duplicate_consumables dc
WHERE ci.consumable_id = dc.id
  AND dc.rn > 1;

-- Удаляем дубликаты расходников
DELETE FROM consumables
WHERE id IN (
  SELECT id
  FROM duplicate_consumables
  WHERE rn > 1
);

-- Показываем результат
SELECT
  'DELETED' as status,
  COUNT(*) as count
FROM duplicate_consumables
WHERE rn > 1;

-- Добавляем UNIQUE constraint чтобы предотвратить дубликаты в будущем
-- (model может быть NULL, поэтому используем частичный индекс)
CREATE UNIQUE INDEX IF NOT EXISTS consumables_model_unique
ON consumables (model)
WHERE model IS NOT NULL;

-- Для расходников без model используем комбинацию name + category
CREATE UNIQUE INDEX IF NOT EXISTS consumables_name_category_unique
ON consumables (name, COALESCE(category, ''))
WHERE model IS NULL;

COMMIT;

-- Показываем итоговую статистику
SELECT
  name,
  model,
  COUNT(*) as remaining_count
FROM consumables
GROUP BY name, model
HAVING COUNT(*) > 1;
