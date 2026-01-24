#!/bin/bash

# =============================================================================
# Elements Platform - Скрипт развертывания на VDS
# =============================================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функции для вывода
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Проверка запуска от root
if [ "$EUID" -ne 0 ]; then 
    error "Запустите скрипт с правами root (sudo ./deploy.sh)"
fi

info "=== Начало развертывания Elements Platform ==="

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    warn "Docker не установлен. Устанавливаем..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    info "Docker установлен"
fi

# Проверка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    warn "Docker Compose не установлен. Устанавливаем..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    info "Docker Compose установлен"
fi

# Создание директорий
info "Создание необходимых директорий..."
mkdir -p ssl
mkdir -p backups
mkdir -p nginx/conf.d

# Проверка .env файла
if [ ! -f .env.production ]; then
    warn ".env.production не найден. Копируем из примера..."
    if [ -f .env.production.example ]; then
        cp .env.production.example .env.production
        warn "Отредактируйте .env.production перед продолжением!"
        warn "Нажмите Enter когда закончите редактирование..."
        read
    else
        error ".env.production.example не найден!"
    fi
fi

# Загрузка переменных окружения
export $(cat .env.production | grep -v '^#' | xargs)

info "Остановка старых контейнеров (если есть)..."
docker-compose -f docker-compose.prod.yml down || true

info "Сборка и запуск контейнеров..."
docker-compose -f docker-compose.prod.yml up -d --build

info "Ожидание запуска базы данных..."
sleep 10

info "Инициализация базы данных..."
docker exec elements-backend python scripts/init_db.py || warn "База данных уже инициализирована"

info "Применение миграций..."
if [ -f backend/migrations/change_equipment_owner_to_employee.sql ]; then
    docker exec elements-postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f /backups/../migrations/change_equipment_owner_to_employee.sql || warn "Миграция уже применена"
fi

info "Проверка статуса контейнеров..."
docker-compose -f docker-compose.prod.yml ps

info "=== Развертывание завершено ==="
info ""
info "Приложение доступно по адресу: http://$(hostname -I | awk '{print $1}')"
info "Данные для входа:"
info "  Email: $SEED_ADMIN_EMAIL"
info "  Password: $SEED_ADMIN_PASSWORD"
info ""
info "Полезные команды:"
info "  - Логи: docker-compose -f docker-compose.prod.yml logs -f"
info "  - Остановка: docker-compose -f docker-compose.prod.yml down"
info "  - Перезапуск: docker-compose -f docker-compose.prod.yml restart"
info "  - Резервное копирование БД: ./backup.sh"
info ""
warn "ВАЖНО: Настройте SSL сертификаты для production!"
warn "Инструкции в файле DEPLOYMENT.md"
