-- Миграция: Заявки на оборудование (Equipment Requests)
-- Дата: 2026-01-18
-- Описание: Модуль для заявок сотрудников на новое оборудование или замену

-- Таблица заявок на оборудование
CREATE TABLE IF NOT EXISTS equipment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Основная информация
  title TEXT NOT NULL,
  description TEXT,
  equipment_category TEXT NOT NULL,  -- computer, monitor, printer, network, server, mobile, peripheral, other
  request_type TEXT NOT NULL DEFAULT 'new'
    CHECK (request_type IN ('new', 'replacement', 'upgrade')),
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Срочность и обоснование
  urgency TEXT NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  justification TEXT,  -- Обоснование необходимости

  -- Статус
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'ordered', 'received', 'issued', 'cancelled')),

  -- Связи с пользователями
  requester_id UUID NOT NULL REFERENCES users(id),
  reviewer_id UUID REFERENCES users(id),  -- Кто одобрил/отклонил

  -- Связь с существующим оборудованием (для замены)
  replace_equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,

  -- Связь с выданным оборудованием (после выполнения)
  issued_equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,

  -- Закупка
  estimated_cost NUMERIC(12, 2),

  -- Комментарии от reviewer
  review_comment TEXT,

  -- Даты
  reviewed_at TIMESTAMPTZ,
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_equipment_requests_status ON equipment_requests(status);
CREATE INDEX IF NOT EXISTS idx_equipment_requests_requester ON equipment_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_equipment_requests_reviewer ON equipment_requests(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_equipment_requests_category ON equipment_requests(equipment_category);
CREATE INDEX IF NOT EXISTS idx_equipment_requests_urgency ON equipment_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_equipment_requests_created ON equipment_requests(created_at DESC);

-- Индекс для списка закупок (одобренные заявки)
CREATE INDEX IF NOT EXISTS idx_equipment_requests_procurement
  ON equipment_requests(status, created_at)
  WHERE status IN ('approved', 'ordered');

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_equipment_requests_updated_at
  BEFORE UPDATE ON equipment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Комментарии для документации
COMMENT ON TABLE equipment_requests IS 'Заявки сотрудников на оборудование';
COMMENT ON COLUMN equipment_requests.equipment_category IS 'Категория оборудования: computer, monitor, printer, network, server, mobile, peripheral, other';
COMMENT ON COLUMN equipment_requests.request_type IS 'Тип заявки: new (новое), replacement (замена), upgrade (улучшение)';
COMMENT ON COLUMN equipment_requests.urgency IS 'Срочность: low, normal, high, critical';
COMMENT ON COLUMN equipment_requests.status IS 'Статус: pending, approved, rejected, ordered, received, issued, cancelled';
COMMENT ON COLUMN equipment_requests.justification IS 'Обоснование необходимости оборудования';
COMMENT ON COLUMN equipment_requests.replace_equipment_id IS 'Ссылка на оборудование для замены (при request_type = replacement)';
COMMENT ON COLUMN equipment_requests.issued_equipment_id IS 'Ссылка на выданное оборудование после выполнения заявки';
COMMENT ON COLUMN equipment_requests.estimated_cost IS 'Ориентировочная стоимость закупки';
COMMENT ON COLUMN equipment_requests.review_comment IS 'Комментарий при одобрении/отклонении заявки';

-- Вывод информации о миграции
DO $$
BEGIN
  RAISE NOTICE 'Миграция equipment_requests успешно применена';
  RAISE NOTICE 'Создана таблица equipment_requests';
  RAISE NOTICE 'Статусы: pending, approved, rejected, ordered, received, issued, cancelled';
  RAISE NOTICE 'Типы заявок: new, replacement, upgrade';
END $$;
