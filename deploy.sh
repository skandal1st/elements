#!/bin/bash
# =============================================================================
# Elements Platform - Скрипт деплоя
# =============================================================================
# Использование: ./deploy.sh [опции]
# Опции:
#   --no-build    Не пересобирать контейнеры
#   --migrate     Только применить миграции
#   --restart     Только перезапустить контейнеры
# =============================================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Директория проекта (где лежит этот скрипт)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Elements Platform - Deploy${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""

# Текущая версия
CURRENT_VERSION=$(git describe --tags --always 2>/dev/null || echo "dev")
echo -e "Текущая версия: ${YELLOW}${CURRENT_VERSION}${NC}"
echo -e "Ветка: ${YELLOW}$(git branch --show-current)${NC}"
echo ""

# Парсинг аргументов
NO_BUILD=false
MIGRATE_ONLY=false
RESTART_ONLY=false

for arg in "$@"; do
    case $arg in
        --no-build)
            NO_BUILD=true
            ;;
        --migrate)
            MIGRATE_ONLY=true
            ;;
        --restart)
            RESTART_ONLY=true
            ;;
    esac
done

# Только миграции
if [ "$MIGRATE_ONLY" = true ]; then
    echo -e "${YELLOW}Применение миграций...${NC}"
    docker-compose exec -T backend python backend/scripts/init_db.py
    echo -e "${GREEN}Миграции применены!${NC}"
    exit 0
fi

# Только перезапуск
if [ "$RESTART_ONLY" = true ]; then
    echo -e "${YELLOW}Перезапуск контейнеров...${NC}"
    docker-compose restart
    echo -e "${GREEN}Контейнеры перезапущены!${NC}"
    exit 0
fi

# Полный деплой
echo -e "${YELLOW}[1/5] Получение изменений из репозитория...${NC}"
git fetch origin
git pull origin $(git branch --show-current)

NEW_VERSION=$(git describe --tags --always 2>/dev/null || echo "dev")
echo -e "Новая версия: ${GREEN}${NEW_VERSION}${NC}"
echo ""

echo -e "${YELLOW}[2/5] Остановка контейнеров...${NC}"
docker-compose down

if [ "$NO_BUILD" = true ]; then
    echo -e "${YELLOW}[3/5] Запуск контейнеров (без пересборки)...${NC}"
    docker-compose up -d
else
    echo -e "${YELLOW}[3/5] Пересборка и запуск контейнеров...${NC}"
    docker-compose up -d --build
fi

echo ""
echo -e "${YELLOW}[4/5] Ожидание запуска сервисов (10 сек)...${NC}"
sleep 10

echo -e "${YELLOW}[5/5] Применение миграций БД...${NC}"
docker-compose exec -T backend python backend/scripts/init_db.py

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Деплой завершен успешно!${NC}"
echo -e "${GREEN}=============================================${NC}"
echo -e "Версия: ${YELLOW}${NEW_VERSION}${NC}"
echo -e "Время: ${YELLOW}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

# Показать статус контейнеров
echo -e "${YELLOW}Статус контейнеров:${NC}"
docker-compose ps
