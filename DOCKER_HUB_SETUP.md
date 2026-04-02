# Настройка Docker Hub для избежания Rate Limit

## Проблема

При развертывании вы можете столкнуться с ошибкой:

```
Error response from daemon: error from registry: 
You have reached your unauthenticated pull rate limit. 
https://www.docker.com/increase-rate-limit
```

## Почему это происходит?

Docker Hub ограничивает количество pull-запросов:
- **Анонимные пользователи**: 100 pull каждые 6 часов с одного IP
- **Авторизованные пользователи (бесплатно)**: 200 pull каждые 6 часов
- **Pro подписка**: неограниченно

## 🚀 Решение (рекомендуется)

### Вариант 1: Автоматический скрипт

```bash
# Запустите скрипт
sudo ./fix-docker-rate-limit.sh

# Выберите вариант 1
# Введите username и password от Docker Hub
```

### Вариант 2: Ручная настройка

#### Шаг 1: Регистрация (если нет аккаунта)

1. Откройте https://hub.docker.com/signup
2. Заполните форму:
   - Username
   - Email
   - Password (минимум 9 символов)
3. Подтвердите email

#### Шаг 2: Вход в Docker

```bash
# На сервере выполните
docker login

# Введите:
# Username: ваш_username
# Password: ваш_password
```

После успешного входа:
```
Login Succeeded
```

#### Шаг 3: Проверка

```bash
# Проверьте авторизацию
docker info | grep Username

# Должно вывести ваш username
```

#### Шаг 4: Продолжите развертывание

```bash
sudo ./deploy.sh
```

## Альтернативные решения

### Вариант 3: Использование зеркал Docker Hub

```bash
# Запустите скрипт
sudo ./fix-docker-rate-limit.sh

# Выберите вариант 3 (автоматическая настройка зеркал)
```

Или вручную:

```bash
# Создайте/отредактируйте файл
sudo nano /etc/docker/daemon.json

# Добавьте:
{
  "registry-mirrors": [
    "https://mirror.gcr.io",
    "https://docker.mirrors.ustc.edu.cn"
  ]
}

# Перезапустите Docker
sudo systemctl restart docker

# Проверьте
docker info | grep -A 5 "Registry Mirrors"
```

### Вариант 4: Использование альтернативных registry

Замените образы в `docker-compose.prod.yml`:

```yaml
# Вместо:
image: postgres:14-alpine

# Используйте:
image: docker.io/library/postgres:14-alpine
# или
image: ghcr.io/library/postgres:14-alpine  # GitHub Container Registry
```

### Вариант 5: Локальное кеширование образов

Если вы часто пересобираете:

```bash
# Загрузите образы заранее
docker pull postgres:14-alpine
docker pull redis:7-alpine
docker pull nginx:alpine

# Теперь они в локальном кеше
docker images

# Развертывание будет использовать локальные образы
sudo ./deploy.sh
```

## Проверка лимитов

### Проверка текущего лимита

```bash
# Анонимный лимит (без авторизации)
TOKEN=$(curl "https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull" | jq -r .token)
curl --head -H "Authorization: Bearer $TOKEN" https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest 2>&1 | grep -i ratelimit

# Вывод покажет:
# ratelimit-limit: 100;w=21600      (максимум)
# ratelimit-remaining: 50;w=21600   (осталось)
```

### После авторизации

```bash
# Получите токен с авторизацией
TOKEN=$(curl --user 'username:password' "https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull" | jq -r .token)
curl --head -H "Authorization: Bearer $TOKEN" https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest 2>&1 | grep -i ratelimit

# Лимит должен быть 200
```

## Рекомендации

### Для production серверов

1. **Всегда используйте Docker Hub аккаунт**
   ```bash
   docker login
   ```

2. **Настройте зеркала как backup**
   ```bash
   sudo ./fix-docker-rate-limit.sh  # вариант 3
   ```

3. **Кешируйте образы локально**
   ```bash
   # После первой успешной загрузки образы остаются в кеше
   docker images
   ```

### Для CI/CD

Используйте Docker Hub токены вместо пароля:

1. Создайте токен: https://hub.docker.com/settings/security
2. Используйте в CI:
   ```bash
   echo $DOCKER_TOKEN | docker login -u $DOCKER_USERNAME --password-stdin
   ```

## Часто задаваемые вопросы

**Q: Безопасно ли хранить учетные данные Docker Hub на сервере?**

A: Docker хранит credentials в `~/.docker/config.json` с ограниченными правами доступа. Для production рекомендуется использовать токены вместо паролей.

**Q: Нужно ли платить за Docker Hub?**

A: Нет! Бесплатный аккаунт дает 200 pull каждые 6 часов, чего достаточно для большинства случаев.

**Q: Как часто нужно выполнять docker login?**

A: Один раз. Авторизация сохраняется до явного выхода (`docker logout`).

**Q: Что делать если забыл пароль?**

A: Восстановите на https://hub.docker.com/reset-password/

**Q: Можно ли использовать чужой Docker Hub аккаунт?**

A: Технически да, но лучше создать свой. Это бесплатно и займет 2 минуты.

## Дополнительные ресурсы

- Docker Hub: https://hub.docker.com/
- Rate Limit документация: https://docs.docker.com/docker-hub/download-rate-limit/
- Зеркала: https://github.com/docker/roadmap/issues/371

## Быстрая справка

```bash
# Проверка авторизации
docker info | grep Username

# Вход
docker login

# Выход
docker logout

# Список локальных образов
docker images

# Удаление неиспользуемых образов (освобождение места)
docker image prune -a

# Проверка лимитов
./fix-docker-rate-limit.sh
```

## Готово!

После настройки Docker Hub вы сможете развертывать приложение без ограничений.

Рекомендуется выполнить `docker login` **перед** запуском `deploy.sh`.
