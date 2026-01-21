-- Миграция: Обновление функции получения расходников для включения consumable_type

-- Удаляем старую функцию, если она существует
DROP FUNCTION IF EXISTS get_consumables_for_equipment(UUID);

-- Создаем обновленную функцию для получения расходных материалов для оборудования
CREATE FUNCTION get_consumables_for_equipment(
  p_equipment_id UUID
)
RETURNS TABLE (
  consumable_id UUID,
  consumable_name TEXT,
  consumable_model TEXT,
  consumable_category TEXT,
  consumable_type TEXT,
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
    c.model AS consumable_model,
    c.category AS consumable_category,
    c.consumable_type AS consumable_type,
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

