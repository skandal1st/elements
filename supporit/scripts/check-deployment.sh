#!/bin/bash

# Скрипт проверки готовности к развертыванию
# Использование: ./scripts/check-deployment.sh

set -e

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PASS="${GREEN}✓${NC}"
FAIL="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"

errors=0
warnings=0

check() {
    if [ $? -eq 0 ]; then
        echo -e "$PASS $1"
    else
        echo -e "$FAIL $1"
        ((errors++))
    fi
}

warn() {
    echo -e "$WARN $1"
    ((warnings++))
}

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo "Проверка готовности к развертыванию..."
echo ""

# Проверка Node.js
info "Проверка Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        check "Node.js установлен: $(node --version)"
    else
        echo -e "$FAIL Node.js версия слишком старая: $(node --version) (требуется 18+)"
        ((errors++))
    fi
else
    echo -e "$FAIL Node.js не установлен"
    ((errors++))
fi

# Проверка npm
info "Проверка npm..."
command -v npm &> /dev/null
check "npm установлен: $(npm --version)"

# Проверка PostgreSQL
info "Проверка PostgreSQL..."
if command -v psql &> /dev/null; then
    check "PostgreSQL установлен: $(psql --version | head -n1)"
    
    # Проверка запуска PostgreSQL
    if systemctl is-active --quiet postgresql 2>/dev/null || pg_isready -q 2>/dev/null; then
        check "PostgreSQL запущен"
    else
        echo -e "$WARN PostgreSQL не запущен"
        ((warnings++))
    fi
else
    echo -e "$FAIL PostgreSQL не установлен"
    ((errors++))
fi

# Проверка Nginx
info "Проверка Nginx..."
if command -v nginx &> /dev/null; then
    check "Nginx установлен: $(nginx -v 2>&1 | cut -d'/' -f2)"
else
    warn "Nginx не установлен (необязательно, но рекомендуется)"
fi

# Проверка файлов проекта
info "Проверка файлов проекта..."
[ -f "package.json" ] && check "package.json найден" || echo -e "$FAIL package.json не найден" && ((errors++))
[ -f "server/package.json" ] && check "server/package.json найден" || echo -e "$FAIL server/package.json не найден" && ((errors++))
[ -f "supabase/schema_postgres.sql" ] && check "schema_postgres.sql найден" || echo -e "$FAIL schema_postgres.sql не найден" && ((errors++))

# Проверка переменных окружения
info "Проверка переменных окружения..."
if [ -f "server/.env" ]; then
    check "server/.env найден"
    
    # Проверка критических переменных
    source <(grep -E '^(DATABASE_URL|JWT_SECRET|NODE_ENV)=' server/.env 2>/dev/null | sed 's/^/export /')
    
    if [ -n "$DATABASE_URL" ]; then
        check "DATABASE_URL установлен"
    else
        echo -e "$FAIL DATABASE_URL не установлен в server/.env"
        ((errors++))
    fi
    
    if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "your-secret-key-change-in-production" ]; then
        check "JWT_SECRET установлен и изменен"
    else
        echo -e "$WARN JWT_SECRET не установлен или использует значение по умолчанию"
        ((warnings++))
    fi
    
    if [ "$NODE_ENV" = "production" ]; then
        check "NODE_ENV=production"
    else
        warn "NODE_ENV не установлен в production"
    fi
else
    echo -e "$WARN server/.env не найден (создайте на основе server/env.production.example)"
    ((warnings++))
fi

if [ -f ".env" ]; then
    check ".env найден"
    
    source <(grep -E '^VITE_API_URL=' .env 2>/dev/null | sed 's/^/export /')
    if [ -n "$VITE_API_URL" ]; then
        check "VITE_API_URL установлен"
    else
        warn "VITE_API_URL не установлен в .env"
        ((warnings++))
    fi
else
    warn ".env не найден (создайте на основе .env.production.example)"
    ((warnings++))
fi

# Проверка .gitignore
info "Проверка .gitignore..."
if grep -q "\.env" .gitignore 2>/dev/null; then
    check ".env файлы в .gitignore"
else
    warn ".env файлы не в .gitignore"
    ((warnings++))
fi

# Проверка зависимостей
info "Проверка зависимостей..."
if [ -d "node_modules" ]; then
    check "Зависимости фронтенда установлены"
else
    warn "Зависимости фронтенда не установлены (выполните npm install)"
    ((warnings++))
fi

if [ -d "server/node_modules" ]; then
    check "Зависимости бэкенда установлены"
else
    warn "Зависимости бэкенда не установлены (выполните cd server && npm install)"
    ((warnings++))
fi

# Проверка уязвимостей
info "Проверка уязвимостей..."
if [ -d "node_modules" ]; then
    if npm audit --audit-level=moderate --silent 2>/dev/null; then
        check "Нет критических уязвимостей в зависимостях фронтенда"
    else
        warn "Обнаружены уязвимости в зависимостях фронтенда (выполните npm audit)"
        ((warnings++))
    fi
fi

if [ -d "server/node_modules" ]; then
    if cd server && npm audit --audit-level=moderate --silent 2>/dev/null; then
        check "Нет критических уязвимостей в зависимостях бэкенда"
    else
        warn "Обнаружены уязвимости в зависимостях бэкенда (выполните npm audit)"
        ((warnings++))
    fi
    cd ..
fi

# Итоги
echo ""
echo "=========================================="
if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}Все проверки пройдены!${NC}"
    exit 0
elif [ $errors -eq 0 ]; then
    echo -e "${YELLOW}Проверки пройдены с предупреждениями ($warnings)${NC}"
    exit 0
else
    echo -e "${RED}Обнаружены ошибки ($errors) и предупреждения ($warnings)${NC}"
    echo ""
    echo "Исправьте ошибки перед развертыванием!"
    exit 1
fi

