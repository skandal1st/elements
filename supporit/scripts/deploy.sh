#!/bin/bash

# Скрипт автоматического развертывания на Ubuntu сервере
# Использование: ./scripts/deploy.sh

set -e  # Остановка при ошибке

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
}

# Проверка, что скрипт запущен от root или с sudo
if [ "$EUID" -ne 0 ]; then 
    error "Пожалуйста, запустите скрипт с sudo"
    exit 1
fi

# Переменные
PROJECT_DIR="/opt/supporit"
APP_USER="supporit"
DB_NAME="supporit"
DB_USER="supporit_db"

info "Начало развертывания Supporit на Ubuntu..."

# Шаг 1: Обновление системы
info "Обновление системы..."
apt-get update -qq
apt-get upgrade -y -qq

# Шаг 2: Установка необходимых пакетов
info "Установка необходимых пакетов..."
apt-get install -y curl wget git build-essential

# Шаг 3: Установка Node.js (если не установлен)
if ! command -v node &> /dev/null; then
    info "Установка Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    info "Node.js уже установлен: $(node --version)"
fi

# Шаг 4: Установка PostgreSQL (если не установлен)
if ! command -v psql &> /dev/null; then
    info "Установка PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
else
    info "PostgreSQL уже установлен: $(psql --version)"
fi

# Шаг 5: Установка Nginx (если не установлен)
if ! command -v nginx &> /dev/null; then
    info "Установка Nginx..."
    apt-get install -y nginx
    systemctl start nginx
    systemctl enable nginx
else
    info "Nginx уже установлен"
fi

# Шаг 6: Создание пользователя приложения
if ! id "$APP_USER" &>/dev/null; then
    info "Создание пользователя $APP_USER..."
    useradd -r -s /bin/bash -d "$PROJECT_DIR" -m "$APP_USER"
else
    info "Пользователь $APP_USER уже существует"
fi

# Шаг 7: Создание директории проекта
info "Создание директории проекта..."
mkdir -p "$PROJECT_DIR"
chown -R "$APP_USER:$APP_USER" "$PROJECT_DIR"

# Шаг 8: Настройка PostgreSQL
info "Настройка базы данных PostgreSQL..."

# Создание пользователя БД (если не существует)
sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD 'changeme_in_production';"

# Создание базы данных (если не существует)
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Предоставление прав
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;"

warn "ВАЖНО: Измените пароль пользователя БД командой:"
warn "sudo -u postgres psql -c \"ALTER USER $DB_USER WITH PASSWORD 'ваш_надежный_пароль';\""

# Шаг 9: Копирование файлов проекта
info "Копирование файлов проекта..."
warn "Убедитесь, что файлы проекта находятся в текущей директории"
warn "Или скопируйте их вручную в $PROJECT_DIR"

# Шаг 10: Установка зависимостей
info "Установка зависимостей проекта..."
if [ -d "$PROJECT_DIR" ] && [ -f "$PROJECT_DIR/package.json" ]; then
    cd "$PROJECT_DIR"
    sudo -u "$APP_USER" npm install --production=false
    
    if [ -d "$PROJECT_DIR/server" ] && [ -f "$PROJECT_DIR/server/package.json" ]; then
        cd "$PROJECT_DIR/server"
        sudo -u "$APP_USER" npm install --production=false
    fi
else
    warn "Директория проекта не найдена. Пропуск установки зависимостей."
    warn "Выполните установку вручную после копирования файлов."
fi

info "Развертывание завершено!"
info ""
info "Следующие шаги:"
info "1. Скопируйте файлы проекта в $PROJECT_DIR"
info "2. Настройте переменные окружения (см. server/.env.example и .env.example)"
info "3. Примените схему БД: sudo -u postgres psql -d $DB_NAME -f $PROJECT_DIR/supabase/schema_postgres.sql"
info "4. Примените миграции из папки supabase/"
info "5. Соберите проект: cd $PROJECT_DIR && npm run build && cd server && npm run build"
info "6. Настройте systemd сервис (см. scripts/supporit-api.service)"
info "7. Настройте Nginx (см. scripts/nginx-supporit.conf)"
info "8. Измените пароль пользователя БД!"
info ""
warn "Для полной настройки см. PRODUCTION_DEPLOYMENT.md"

