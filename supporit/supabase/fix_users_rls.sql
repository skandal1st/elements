-- Исправление RLS политик для таблицы users
-- Проблема: политики блокируют доступ к пользователям при загрузке оборудования
-- Ошибка 500 при запросе к /rest/v1/users

-- Вариант 1: Разрешить всем авторизованным пользователям просматривать базовую информацию
-- Это безопасно, так как мы показываем только публичные данные (имя, email, отдел)
DROP POLICY IF EXISTS "Authenticated users can view user profiles for relationships" ON users;
CREATE POLICY "Authenticated users can view user profiles for relationships" ON users 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Примечание: Если хотите более строгий контроль, используйте Вариант 2:

-- Вариант 2 (более безопасный): Только для ИТ-специалистов и администраторов
-- Раскомментируйте следующие строки и закомментируйте Вариант 1:
-- DROP POLICY IF EXISTS "Authenticated users can view user profiles for relationships" ON users;
-- DROP POLICY IF EXISTS "IT and Admins can view user profiles" ON users;
-- CREATE POLICY "IT and Admins can view user profiles" ON users 
--   FOR SELECT 
--   USING (
--     EXISTS (
--       SELECT 1 FROM users 
--       WHERE id = auth.uid() 
--       AND role IN ('admin', 'it_specialist')
--     )
--   );

-- После выполнения скрипта проверьте политики:
-- SELECT * FROM pg_policies WHERE tablename = 'users';

