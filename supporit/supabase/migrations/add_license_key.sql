-- Добавление поля license_key в таблицу software_licenses
ALTER TABLE software_licenses
ADD COLUMN IF NOT EXISTS license_key TEXT;

-- Добавляем комментарий для документирования
COMMENT ON COLUMN software_licenses.license_key IS 'Лицензионный ключ или ключи (можно хранить несколько через запятую или JSON)';
