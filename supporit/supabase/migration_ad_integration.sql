-- Миграция для интеграции с Active Directory
-- Добавляет поле ad_username для связи локальных пользователей с AD

-- Добавляем колонку ad_username
ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_username VARCHAR(255);

-- Создаем уникальный индекс для ad_username (только для непустых значений)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ad_username
ON users (ad_username)
WHERE ad_username IS NOT NULL;

-- Комментарий к колонке
COMMENT ON COLUMN users.ad_username IS 'sAMAccountName пользователя в Active Directory';
