-- Проверка и исправление миграции password_hash
-- Этот скрипт проверяет текущее состояние и применяет миграцию если нужно

-- Проверка текущего состояния
SELECT 
    column_name, 
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'password_hash'
  AND table_schema = 'public';

-- Применение миграции (если is_nullable = 'NO')
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
          AND column_name = 'password_hash'
          AND table_schema = 'public'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
        RAISE NOTICE 'Миграция применена: password_hash теперь может быть NULL';
    ELSE
        RAISE NOTICE 'Миграция уже применена: password_hash может быть NULL';
    END IF;
END $$;

-- Финальная проверка
SELECT 
    column_name, 
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'password_hash'
  AND table_schema = 'public';

