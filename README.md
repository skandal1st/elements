# Elements Platform

Единая платформа для управления HR, IT и другими модулями предприятия.

## 🚀 Быстрое развертывание на VDS

**Для production развертывания смотрите:**
- [QUICK_DEPLOY.md](QUICK_DEPLOY.md) - Развертывание за 5 минут
- [DEPLOYMENT.md](DEPLOYMENT.md) - Полная инструкция
- [CHECK_BEFORE_DEPLOY.md](CHECK_BEFORE_DEPLOY.md) - Чеклист перед развертыванием

## 💻 Локальная разработка

### Требования

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis (опционально, для кеширования)
- Docker & Docker Compose (рекомендуется)

### Backend

1. Установите зависимости:
```bash
cd backend
pip install -r requirements.txt
```

2. Настройте переменные окружения (создайте `.env`):
```env
DATABASE_URL=postgresql://elements:elements@localhost:5432/elements
SECRET_KEY=your-secret-key-min-32-chars
REDIS_URL=redis://localhost:6379/0
LICENSE_SERVER_URL=http://localhost:8001
COMPANY_ID=your-company-id
ENABLED_MODULES=hr,it
```

3. Создайте базу данных и выполните миграции:
```bash
# Создайте БД PostgreSQL
createdb elements

# Инициализируйте таблицы и создайте администратора
python scripts/init_db.py
```

4. Запустите сервер:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

1. Установите зависимости:
```bash
cd frontend
npm install
```

2. Запустите dev сервер:
```bash
npm run dev
```

Frontend будет доступен на `http://localhost:5173`

### Первый вход

После запуска `init_db.py` будет создан администратор:
- Email: `admin@elements.local` (или из `SEED_ADMIN_EMAIL`)
- Password: `admin123` (или из `SEED_ADMIN_PASSWORD`)

## Структура проекта

- `backend/` - FastAPI backend (модульный монолит)
- `frontend/` - React frontend (единое приложение)
- `license-server/` - Облачный сервер лицензирования

## Модули

- **HR** - Управление кадрами
- **IT** - Учет оборудования и заявки
- **Portal** - Стартовая страница с агрегацией данных
- **Finance** - Финансовый учет (планируется)

## Документация

### Для разработки
- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) - Дорожная карта
- [ARCHITECTURE.md](ARCHITECTURE.md) - Архитектура системы
- [TESTING.md](TESTING.md) - Тестирование

### Для развертывания
- [QUICK_DEPLOY.md](QUICK_DEPLOY.md) - Быстрое развертывание
- [DEPLOYMENT.md](DEPLOYMENT.md) - Полное руководство
- [CHECK_BEFORE_DEPLOY.md](CHECK_BEFORE_DEPLOY.md) - Чеклист
- [DOCKER_HUB_SETUP.md](DOCKER_HUB_SETUP.md) - Настройка Docker Hub

### Решение проблем
- [РЕШЕНИЕ_ОШИБКИ_RATE_LIMIT.txt](РЕШЕНИЕ_ОШИБКИ_RATE_LIMIT.txt) - Docker Hub rate limit

## Развертывание с Docker

```bash
# Development
docker-compose up -d

# Production
cp .env.production.example .env.production
# Отредактируйте .env.production
sudo ./deploy.sh
```
