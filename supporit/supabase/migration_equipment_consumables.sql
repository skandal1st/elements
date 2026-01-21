-- Миграция: Расширение схемы для связи оборудования с расходными материалами и заявками

-- Таблица связи оборудования с расходными материалами
-- Определяет, какие расходники нужны для какого оборудования
CREATE TABLE IF NOT EXISTS equipment_consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  quantity_per_unit INTEGER NOT NULL DEFAULT 1, -- Сколько расходников нужно на единицу оборудования
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(equipment_id, consumable_id)
);

-- Добавляем поле location_room в tickets для фильтрации оборудования по кабинету
ALTER TABLE tickets 
  ADD COLUMN IF NOT EXISTS location_room TEXT,
  ADD COLUMN IF NOT EXISTS location_department TEXT;

-- Индексы для улучшения производительности
CREATE INDEX IF NOT EXISTS idx_equipment_consumables_equipment ON equipment_consumables(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_consumables_consumable ON equipment_consumables(consumable_id);
CREATE INDEX IF NOT EXISTS idx_tickets_location ON tickets(location_department, location_room);
CREATE INDEX IF NOT EXISTS idx_equipment_location ON equipment(location_department, location_room);

-- Функция для получения оборудования в кабинете
CREATE OR REPLACE FUNCTION get_equipment_by_location(
  p_department TEXT,
  p_room TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  model TEXT,
  inventory_number TEXT,
  category TEXT,
  status TEXT,
  location_department TEXT,
  location_room TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.name,
    e.model,
    e.inventory_number,
    e.category,
    e.status,
    e.location_department,
    e.location_room
  FROM equipment e
  WHERE 
    (p_department IS NULL OR e.location_department = p_department)
    AND (p_room IS NULL OR e.location_room = p_room)
    AND e.status != 'written_off'
  ORDER BY e.name;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения расходных материалов для оборудования
CREATE OR REPLACE FUNCTION get_consumables_for_equipment(
  p_equipment_id UUID
)
RETURNS TABLE (
  consumable_id UUID,
  consumable_name TEXT,
  consumable_category TEXT,
  quantity_per_unit INTEGER,
  quantity_in_stock INTEGER,
  min_quantity INTEGER,
  is_low_stock BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS consumable_id,
    c.name AS consumable_name,
    c.category AS consumable_category,
    ec.quantity_per_unit,
    c.quantity_in_stock,
    c.min_quantity,
    (c.quantity_in_stock <= c.min_quantity) AS is_low_stock
  FROM equipment_consumables ec
  JOIN consumables c ON ec.consumable_id = c.id
  WHERE ec.equipment_id = p_equipment_id
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;




