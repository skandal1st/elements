#!/bin/bash

# Скрипт сборки проекта для продакшена
# Использование: ./scripts/build-production.sh [путь_к_проекту]

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Определение пути к проекту
PROJECT_DIR="${1:-$(pwd)}"

if [ ! -f "$PROJECT_DIR/package.json" ]; then
    error "package.json не найден в $PROJECT_DIR"
    exit 1
fi

info "Сборка проекта для продакшена..."

# Проверка переменных окружения
if [ ! -f "$PROJECT_DIR/.env" ]; then
    warn "Файл .env не найден. Создайте его на основе .env.example"
fi

if [ ! -f "$PROJECT_DIR/server/.env" ]; then
    warn "Файл server/.env не найден. Создайте его на основе server/env.example"
fi

# Установка зависимостей фронтенда
info "Установка зависимостей фронтенда..."
cd "$PROJECT_DIR"
npm ci --production=false

# Сборка фронтенда
info "Сборка фронтенда..."
npm run build

if [ ! -d "$PROJECT_DIR/dist" ]; then
    error "Сборка фронтенда не удалась"
    exit 1
fi

info "Фронтенд собран успешно"

# Установка зависимостей бэкенда
if [ -d "$PROJECT_DIR/server" ] && [ -f "$PROJECT_DIR/server/package.json" ]; then
    info "Установка зависимостей бэкенда..."
    cd "$PROJECT_DIR/server"
    npm ci --production=false
    
    # Сборка бэкенда
    info "Сборка бэкенда..."
    npm run build
    
    if [ ! -d "$PROJECT_DIR/server/dist" ]; then
        error "Сборка бэкенда не удалась"
        exit 1
    fi
    
    info "Бэкенд собран успешно"
else
    warn "Директория server не найдена, пропуск сборки бэкенда"
fi

info "Сборка завершена успешно!"
info ""
info "Следующие шаги:"
info "1. Проверьте файлы в dist/ и server/dist/"
info "2. Настройте переменные окружения для продакшена"
info "3. Запустите сервер или настройте systemd сервис"

