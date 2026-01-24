# Руководство по развертыванию Elements Platform на VDS

## Требования к серверу

### Минимальные требования
- **ОС**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Диск**: 20 GB SSD
- **Порты**: 80 (HTTP), 443 (HTTPS)

### Рекомендуемые требования
- **CPU**: 4 ядра
- **RAM**: 8 GB
- **Диск**: 50 GB SSD

## Подготовка сервера

### 1. Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Установка базовых пакетов

```bash
sudo apt install -y curl wget git ufw
```

### 3. Настройка фаервола

```bash
# Разрешаем SSH, HTTP и HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включаем фаервол
sudo ufw enable
```

## Установка Elements Platform

### 1. Клонирование репозитория

```bash
# Клонируем проект
cd /opt
sudo git clone <your-repo-url> elements
cd elements

# Устанавливаем права
sudo chown -R $USER:$USER /opt/elements
```

### 2. Конфигурация

```bash
# Копируем пример .env файла
cp .env.production.example .env.production

# Редактируем конфигурацию
nano .env.production
```

**Обязательно измените следующие параметры:**

```env
# Пароли базы данных
POSTGRES_PASSWORD=ваш_сильный_пароль_123
REDIS_PASSWORD=ваш_redis_пароль_456

# JWT секрет (минимум 32 символа)
JWT_SECRET=ваш_случайный_секрет_минимум_32_символа

# Данные администратора
SEED_ADMIN_EMAIL=admin@yourdomain.com
SEED_ADMIN_PASSWORD=ваш_admin_пароль

# CORS для вашего домена
CORS_ORIGINS=https://yourdomain.com

# Домен
DOMAIN=yourdomain.com
```

### 3. Запуск установки

```bash
# Делаем скрипт исполняемым
chmod +x deploy.sh backup.sh

# Запускаем установку
sudo ./deploy.sh
```

Скрипт автоматически:
- Установит Docker и Docker Compose
- Создаст необходимые директории
- Соберёт и запустит контейнеры
- Инициализирует базу данных
- Применит миграции

### 4. Проверка установки

```bash
# Проверка статуса контейнеров
docker-compose -f docker-compose.prod.yml ps

# Все контейнеры должны быть в состоянии "Up"

# Проверка логов
docker-compose -f docker-compose.prod.yml logs -f backend
```

## Настройка SSL (Let's Encrypt)

### 1. Установка Certbot

```bash
sudo apt install -y certbot
```

### 2. Получение сертификата

```bash
# Остановите nginx
docker-compose -f docker-compose.prod.yml stop nginx

# Получите сертификат
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Скопируйте сертификаты
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/
sudo chmod 644 ./ssl/*.pem
```

### 3. Включение HTTPS

Раскомментируйте HTTPS блок в `nginx/conf.d/default.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # ... остальные настройки
}
```

### 4. Автоматическое обновление сертификатов

```bash
# Создайте cron задачу
sudo crontab -e

# Добавьте строку (проверка каждый день в 3:00)
0 3 * * * certbot renew --quiet --deploy-hook "cd /opt/elements && docker-compose -f docker-compose.prod.yml restart nginx"
```

## Резервное копирование

### Ручное резервное копирование

```bash
./backup.sh
```

Бэкапы сохраняются в `./backups/` с автоматическим сжатием.

### Автоматическое резервное копирование

```bash
# Добавьте в crontab (каждый день в 2:00)
sudo crontab -e

0 2 * * * cd /opt/elements && ./backup.sh
```

### Восстановление из резервной копии

```bash
# Распаковка бэкапа
gunzip backups/elements_YYYYMMDD_HHMMSS.sql.gz

# Восстановление
docker exec -i elements-postgres psql -U elements -d elements < backups/elements_YYYYMMDD_HHMMSS.sql
```

## Мониторинг и обслуживание

### Просмотр логов

```bash
# Все логи
docker-compose -f docker-compose.prod.yml logs -f

# Логи конкретного сервиса
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Статус контейнеров

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Перезапуск сервисов

```bash
# Перезапуск всего
docker-compose -f docker-compose.prod.yml restart

# Перезапуск конкретного сервиса
docker-compose -f docker-compose.prod.yml restart backend
```

### Обновление приложения

```bash
# Остановка
docker-compose -f docker-compose.prod.yml down

# Обновление кода
git pull

# Пересборка и запуск
docker-compose -f docker-compose.prod.yml up -d --build
```

### Очистка Docker

```bash
# Удаление неиспользуемых образов
docker image prune -a -f

# Удаление неиспользуемых томов
docker volume prune -f
```

## Полезные команды

### Вход в контейнер

```bash
# Backend
docker exec -it elements-backend bash

# База данных
docker exec -it elements-postgres psql -U elements -d elements

# Nginx
docker exec -it elements-nginx sh
```

### Проверка ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Использование диска
docker system df
```

### Экспорт/импорт данных

```bash
# Экспорт данных
docker exec elements-postgres pg_dump -U elements -d elements -t employees > employees.sql

# Импорт данных
docker exec -i elements-postgres psql -U elements -d elements < employees.sql
```

## Решение проблем

### Docker Hub Rate Limit

**Ошибка:**
```
Error response from daemon: error from registry: You have reached your unauthenticated pull rate limit
```

**Причина:** Docker Hub ограничивает анонимные pull-запросы до 100 каждые 6 часов с одного IP.

**Решение 1: Вход в Docker Hub (рекомендуется)**
```bash
# Если нет аккаунта - зарегистрируйтесь на https://hub.docker.com/signup
# Затем войдите:
docker login

# Или используйте автоматический скрипт:
sudo ./fix-docker-rate-limit.sh
```

После входа лимит увеличится до 200 pull-запросов каждые 6 часов (бесплатно).

**Решение 2: Использование зеркал**
```bash
# Автоматическая настройка зеркал
sudo ./fix-docker-rate-limit.sh
# Выберите вариант 3
```

**Решение 3: Ожидание**
Подождите несколько часов и повторите попытку.

### Контейнер не запускается

```bash
# Проверьте логи
docker-compose -f docker-compose.prod.yml logs [service-name]

# Пересоздайте контейнер
docker-compose -f docker-compose.prod.yml up -d --force-recreate [service-name]
```

### Проблемы с подключением к БД

```bash
# Проверьте доступность PostgreSQL
docker exec elements-postgres pg_isready -U elements

# Проверьте переменные окружения
docker exec elements-backend env | grep DATABASE
```

### Ошибки миграций

```bash
# Вход в контейнер backend
docker exec -it elements-backend bash

# Ручной запуск миграций
python scripts/init_db.py
```

### Недостаточно памяти

```bash
# Увеличьте swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Добавьте в /etc/fstab для автозагрузки
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Безопасность

### Рекомендации

1. **Регулярные обновления**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Сильные пароли**
   - Используйте пароли длиной минимум 16 символов
   - Включайте цифры, буквы и спецсимволы

3. **Ограничение SSH**
   ```bash
   # В /etc/ssh/sshd_config
   PermitRootLogin no
   PasswordAuthentication no
   ```

4. **Мониторинг логов**
   ```bash
   sudo tail -f /var/log/auth.log
   docker-compose -f docker-compose.prod.yml logs -f nginx
   ```

5. **Fail2ban**
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи контейнеров
2. Изучите документацию
3. Создайте issue в репозитории

## Чеклист развертывания

- [ ] Сервер обновлен
- [ ] Фаервол настроен
- [ ] Docker установлен
- [ ] .env.production настроен
- [ ] Приложение запущено
- [ ] SSL сертификаты установлены
- [ ] Резервное копирование настроено
- [ ] Мониторинг настроен
- [ ] Пароли изменены на сильные
- [ ] Доступ к приложению проверен
