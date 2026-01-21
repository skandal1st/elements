-- Миграция: Email Threading для ответов на тикеты
-- Дата: 2026-01-18
-- Описание: Добавление поддержки email threading и комментариев из email

-- 1. Добавляем поля для email threading в таблицу tickets
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS email_message_id TEXT,     -- Message-ID оригинального письма
  ADD COLUMN IF NOT EXISTS email_subject TEXT;        -- Оригинальная тема для Re:

-- 2. Делаем user_id nullable в ticket_comments для комментариев из email
ALTER TABLE ticket_comments
  ALTER COLUMN user_id DROP NOT NULL;

-- 3. Добавляем поля для email в ticket_comments
ALTER TABLE ticket_comments
  ADD COLUMN IF NOT EXISTS is_from_email BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_message_id TEXT,
  ADD COLUMN IF NOT EXISTS email_sender TEXT;

-- 4. Индексы для оптимизации поиска по email threading
CREATE INDEX IF NOT EXISTS idx_tickets_email_message_id
  ON tickets(email_message_id) WHERE email_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_comments_email_message_id
  ON ticket_comments(email_message_id) WHERE email_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_comments_is_from_email
  ON ticket_comments(ticket_id, is_from_email) WHERE is_from_email = TRUE;

-- 5. Constraint: если user_id NULL, то email_sender обязателен для email-комментариев
ALTER TABLE ticket_comments
  ADD CONSTRAINT ticket_comments_user_or_email_check
    CHECK (
      (user_id IS NOT NULL) OR
      (user_id IS NULL AND is_from_email = TRUE AND email_sender IS NOT NULL)
    );

-- Комментарии для документации
COMMENT ON COLUMN tickets.email_message_id IS 'Message-ID оригинального письма для email threading';
COMMENT ON COLUMN tickets.email_subject IS 'Оригинальная тема письма для формирования Re: ответов';
COMMENT ON COLUMN ticket_comments.is_from_email IS 'Комментарий создан из входящего email';
COMMENT ON COLUMN ticket_comments.email_message_id IS 'Message-ID письма-ответа для threading';
COMMENT ON COLUMN ticket_comments.email_sender IS 'Email отправителя для комментариев без зарегистрированного пользователя';

-- Вывод информации о миграции
DO $$
BEGIN
  RAISE NOTICE 'Миграция email-threading успешно применена';
  RAISE NOTICE 'Добавлены поля в tickets: email_message_id, email_subject';
  RAISE NOTICE 'Добавлены поля в ticket_comments: is_from_email, email_message_id, email_sender';
  RAISE NOTICE 'user_id в ticket_comments теперь nullable';
END $$;
