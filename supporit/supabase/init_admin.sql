-- Функция для назначения роли администратора первому пользователю
-- Это безопаснее, так как использует SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Находим UUID пользователя по email
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = user_email;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'Пользователь с email % не найден', user_email;
  END IF;
  
  -- Обновляем роль на admin
  UPDATE public.users
  SET role = 'admin'
  WHERE id = user_uuid;
  
  RAISE NOTICE 'Пользователь % теперь администратор', user_email;
END;
$$;

-- Использование функции:
-- SELECT public.make_user_admin('admin@example.com');

-- После создания первого администратора можно удалить эту функцию для безопасности:
-- DROP FUNCTION IF EXISTS public.make_user_admin(TEXT);



