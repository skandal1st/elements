#!/bin/bash

# Скрипт резервного копирования базы данных
# Использование: ./scripts/backup-database.sh [путь_к_проекту]

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Определение пути к проекту
PROJECT_DIR="${1:-$(pwd)}"

# Переменные из .env
if [ -f "$PROJECT_DIR/server/.env" ]; then
    source <(grep -E '^DATABASE_URL=' "$PROJECT_DIR/server/.env" | sed 's/^/export /')
fi

if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL не установлен. Укажите его в server/.env"
    exit 1
fi

# Парсинг DATABASE_URL
DB_INFO=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)|DB_USER=\1 DB_PASS=\2 DB_HOST=\3 DB_PORT=\4 DB_NAME=\5|')
eval "$DB_INFO"

# Создание директории для бэкапов
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
mkdir -p "$BACKUP_DIR"

# Имя файла бэкапа
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/supporit_backup_${TIMESTAMP}.sql"

info "Создание резервной копии базы данных $DB_NAME..."

# Создание бэкапа
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "${BACKUP_FILE%.sql}.dump" 2>/dev/null || \
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    info "Резервная копия создана: $BACKUP_FILE"
    
    # Сжатие (если это SQL файл)
    if [[ "$BACKUP_FILE" == *.sql ]]; then
        info "Сжатие резервной копии..."
        gzip -f "$BACKUP_FILE"
        BACKUP_FILE="${BACKUP_FILE}.gz"
        info "Сжатая копия: $BACKUP_FILE"
    fi
    
    # Удаление старых бэкапов (старше 30 дней)
    find "$BACKUP_DIR" -name "supporit_backup_*.sql*" -mtime +30 -delete 2>/dev/null || true
    
    info "Готово!"
else
    error "Ошибка при создании резервной копии"
    exit 1
fi

