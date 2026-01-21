-- Миграция: Добавление таблицы для хранения выбранных расходников в тикетах

-- Таблица связи тикетов с расходными материалами
-- Позволяет выбирать несколько расходников для одного тикета
CREATE TABLE IF NOT EXISTS ticket_consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticket_id, consumable_id)
);

-- Индексы для улучшения производительности
CREATE INDEX IF NOT EXISTS idx_ticket_consumables_ticket ON ticket_consumables(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_consumables_consumable ON ticket_consumables(consumable_id);

-- Добавляем поле consumable_type в таблицу consumables
ALTER TABLE consumables 
  ADD COLUMN IF NOT EXISTS consumable_type TEXT;


