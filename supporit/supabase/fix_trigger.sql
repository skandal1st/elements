-- Исправление триггера для создания пользователей
-- Выполните этот скрипт, если записи в таблице users не создаются автоматически

-- 1. Пересоздаем функцию с правильными настройками
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'employee'
  )
  ON CONFLICT (id) DO NOTHING; -- Игнорируем, если запись уже существует
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 2. Убеждаемся, что триггер существует
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Примечание: Функция с SECURITY DEFINER обходит RLS, поэтому отдельная политика не нужна

-- 4. Проверяем существующие пользователи в auth.users, у которых нет записи в users
-- Создаем записи для них вручную
INSERT INTO public.users (id, email, full_name, role)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'employee'
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. Проверка: посмотрите сколько пользователей в каждой таблице
-- SELECT COUNT(*) as auth_users_count FROM auth.users;
-- SELECT COUNT(*) as users_table_count FROM public.users;
-- Они должны совпадать (или users_table_count должно быть >= auth_users_count)

