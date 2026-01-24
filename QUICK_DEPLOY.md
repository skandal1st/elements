# Быстрое развертывание Elements Platform на VDS

## За 5 минут

### 1. Подготовка сервера (Ubuntu/Debian)

```bash
# Подключитесь к серверу по SSH
ssh root@your-server-ip

# Обновите систему
apt update && apt upgrade -y

# Установите Git
apt install -y git
```

### 2. Клонирование проекта

```bash
# Перейдите в директорию
cd /opt

# Клонируйте репозиторий
git clone <your-repo-url> elements
cd elements
```

### 3. Настройка переменных окружения

```bash
# Скопируйте пример конфигурации
cp .env.production.example .env.production

# Отредактируйте файл
nano .env.production
```

**Минимальные изменения:**
```env
POSTGRES_PASSWORD=ваш_сильный_пароль
REDIS_PASSWORD=ваш_redis_пароль
JWT_SECRET=случайная_строка_минимум_32_символа
SEED_ADMIN_EMAIL=admin@yourdomain.com
SEED_ADMIN_PASSWORD=admin_пароль
DOMAIN=yourdomain.com
CORS_ORIGINS=https://yourdomain.com
```

### 4. Запуск

```bash
# Запустите скрипт установки
sudo ./deploy.sh
```

Скрипт автоматически:
- ✅ Установит Docker и Docker Compose
- ✅ Создаст необходимые директории
- ✅ Соберёт контейнеры
- ✅ Инициализирует базу данных
- ✅ Запустит приложение

**Если возникла ошибка "rate limit":**
```bash
# Запустите скрипт решения проблемы
sudo ./fix-docker-rate-limit.sh

# Выберите вариант 1 (вход в Docker Hub) - это бесплатно
# Затем повторите развертывание
sudo ./deploy.sh
```

### 5. Проверка

```bash
# Откройте в браузере
http://your-server-ip
```

Данные для входа:
- Email: указанный в `SEED_ADMIN_EMAIL`
- Password: указанный в `SEED_ADMIN_PASSWORD`

## Настройка SSL (опционально)

```bash
# Установите Certbot
apt install -y certbot

# Остановите nginx
docker-compose -f docker-compose.prod.yml stop nginx

# Получите сертификат
certbot certonly --standalone -d yourdomain.com

# Скопируйте сертификаты
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/
chmod 644 ./ssl/*.pem

# Раскомментируйте HTTPS блок в nginx/conf.d/default.conf
nano nginx/conf.d/default.conf

# Перезапустите nginx
docker-compose -f docker-compose.prod.yml up -d nginx
```

## Полезные команды

```bash
# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f

# Перезапуск
docker-compose -f docker-compose.prod.yml restart

# Остановка
docker-compose -f docker-compose.prod.yml down

# Резервное копирование
./backup.sh
```

## Следующие шаги

1. Настройте SSL сертификаты (см. выше)
2. Настройте автоматическое резервное копирование
3. Настройте мониторинг
4. Измените пароль администратора в приложении

## Требования к серверу

**Минимальные:**
- 2 CPU
- 4 GB RAM
- 20 GB SSD
- Ubuntu 20.04+

**Рекомендуемые:**
- 4 CPU
- 8 GB RAM
- 50 GB SSD

## Порты

- `80` - HTTP
- `443` - HTTPS (после настройки SSL)

## Поддержка

Подробная документация: [DEPLOYMENT.md](DEPLOYMENT.md)
