-- Скрипт для создания первого администратора
-- Использование:
-- 1. Зарегистрируйте пользователя через форму регистрации или через Supabase Dashboard
-- 2. Найдите ID пользователя в таблице auth.users (можно через Supabase Dashboard -> Authentication -> Users)
-- 3. Выполните этот SQL скрипт, заменив 'USER_ID_HERE' на реальный UUID пользователя

-- Вариант 1: Если пользователь уже зарегистрирован, найдите его ID и назначьте роль
-- Замените 'USER_EMAIL_HERE' на email зарегистрированного пользователя
UPDATE users
SET role = 'admin'
WHERE email = 'USER_EMAIL_HERE';

-- Вариант 2: Если вы знаете UUID пользователя напрямую из auth.users
-- Замените 'USER_UUID_HERE' на UUID из таблицы auth.users
-- UPDATE users
-- SET role = 'admin'
-- WHERE id = 'USER_UUID_HERE'::uuid;

-- Проверка: убедитесь, что роль назначена
-- SELECT id, email, full_name, role FROM users WHERE role = 'admin';

-- Альтернативный способ: создание администратора напрямую через Supabase Dashboard
-- 1. Перейдите в Authentication -> Users -> Add user
-- 2. Создайте пользователя с email и паролем
-- 3. После создания пользователя выполните UPDATE запрос выше



