#!/bin/bash

# Скрипт для настройки базы данных
# Использование: ./scripts/setup-database.sh [путь_к_проекту]

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
SUPABASE_DIR="$PROJECT_DIR/supabase"

if [ ! -d "$SUPABASE_DIR" ]; then
    error "Директория supabase не найдена в $PROJECT_DIR"
    exit 1
fi

# Переменные из .env (если есть)
if [ -f "$PROJECT_DIR/server/.env" ]; then
    source <(grep -E '^DATABASE_URL=' "$PROJECT_DIR/server/.env" | sed 's/^/export /')
fi

# Парсинг DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL не установлен. Укажите его в server/.env"
    exit 1
fi

# Извлечение параметров из DATABASE_URL
# Формат: postgresql://user:password@host:port/database
DB_INFO=$(echo "$DATABASE_URL" | sed -E 's|postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)|DB_USER=\1 DB_PASS=\2 DB_HOST=\3 DB_PORT=\4 DB_NAME=\5|')
eval "$DB_INFO"

info "Настройка базы данных: $DB_NAME на $DB_HOST:$DB_PORT"

# Применение основной схемы
if [ -f "$SUPABASE_DIR/schema_postgres.sql" ]; then
    info "Применение основной схемы..."
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SUPABASE_DIR/schema_postgres.sql"
else
    error "Файл schema_postgres.sql не найден"
    exit 1
fi

# Применение миграций в правильном порядке
MIGRATIONS=(
    "migration_allow_null_password.sql"
    "migration_buildings.sql"
    "migration_add_consumable_model.sql"
    "migration_equipment_consumables.sql"
    "migration_ticket_consumables.sql"
    "migration_update_consumables_function.sql"
)

info "Применение миграций..."
for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$SUPABASE_DIR/$migration" ]; then
        info "  Применение $migration..."
        PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SUPABASE_DIR/$migration" || warn "  Предупреждение при применении $migration"
    else
        warn "  Файл $migration не найден, пропуск"
    fi
done

info "База данных настроена успешно!"

