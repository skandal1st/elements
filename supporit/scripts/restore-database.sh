#!/bin/bash

# Скрипт восстановления базы данных из резервной копии
# Использование: ./scripts/restore-database.sh <путь_к_бэкапу> [путь_к_проекту]

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

if [ -z "$1" ]; then
    error "Укажите путь к файлу резервной копии"
    echo "Использование: $0 <путь_к_бэкапу> [путь_к_проекту]"
    exit 1
fi

BACKUP_FILE="$1"
PROJECT_DIR="${2:-$(pwd)}"

if [ ! -f "$BACKUP_FILE" ] && [ ! -f "${BACKUP_FILE}.gz" ]; then
    error "Файл резервной копии не найден: $BACKUP_FILE"
    exit 1
fi

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

warn "ВНИМАНИЕ: Это действие перезапишет текущую базу данных $DB_NAME!"
read -p "Вы уверены? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    info "Восстановление отменено"
    exit 0
fi

info "Восстановление базы данных $DB_NAME из $BACKUP_FILE..."

# Распаковка если нужно
TEMP_FILE=""
if [[ "$BACKUP_FILE" == *.gz ]]; then
    info "Распаковка архива..."
    TEMP_FILE=$(mktemp)
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    BACKUP_FILE="$TEMP_FILE"
elif [[ "$BACKUP_FILE" == *.dump ]]; then
    # Восстановление из custom format dump
    info "Восстановление из custom format dump..."
    PGPASSWORD="$DB_PASS" pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists "$BACKUP_FILE"
    if [ -n "$TEMP_FILE" ]; then
        rm -f "$TEMP_FILE"
    fi
    info "Восстановление завершено!"
    exit 0
fi

# Восстановление из SQL
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"

if [ -n "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
fi

info "Восстановление завершено!"

