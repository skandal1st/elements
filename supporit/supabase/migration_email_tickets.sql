-- Миграция: Поддержка тикетов, созданных через email
-- Дата: 2026-01-02
-- Описание: Добавление полей для интеграции с email

-- 1. Делаем creator_id nullable для тикетов от неизвестных отправителей
ALTER TABLE tickets
  ALTER COLUMN creator_id DROP NOT NULL;

-- 2. Добавляем поля для email-интеграции
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS email_sender TEXT,           -- Email отправителя (для случая когда пользователь не найден)
  ADD COLUMN IF NOT EXISTS created_via TEXT             -- Источник создания: 'web', 'email', 'api'
    CHECK (created_via IN ('web', 'email', 'api'));

-- 3. Добавляем статус для тикетов без пользователя
ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_status_check
    CHECK (status IN ('new', 'in_progress', 'waiting', 'resolved', 'closed', 'pending_user'));

-- 4. Constraint: если creator_id NULL, то email_sender обязателен
ALTER TABLE tickets
  ADD CONSTRAINT tickets_creator_or_email_check
    CHECK (
      (creator_id IS NOT NULL) OR
      (creator_id IS NULL AND email_sender IS NOT NULL)
    );

-- 5. Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_tickets_pending_user
  ON tickets(status) WHERE status = 'pending_user';

CREATE INDEX IF NOT EXISTS idx_tickets_email_sender
  ON tickets(email_sender) WHERE email_sender IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_created_via
  ON tickets(created_via) WHERE created_via IS NOT NULL;

-- Комментарии для документации
COMMENT ON COLUMN tickets.email_sender IS 'Email отправителя для тикетов без зарегистрированного пользователя';
COMMENT ON COLUMN tickets.created_via IS 'Источник создания тикета: web (веб-интерфейс), email (почта), api (внешний API)';

-- Вывод информации о миграции
DO $$
BEGIN
  RAISE NOTICE 'Миграция email-интеграции успешно применена';
  RAISE NOTICE 'Добавлены поля: email_sender, created_via';
  RAISE NOTICE 'Добавлен статус: pending_user';
  RAISE NOTICE 'creator_id теперь nullable';
END $$;
