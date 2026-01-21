#!/bin/bash

# Скрипт развертывания HR Desk на продакшн сервере
# Использование: ./scripts/deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Начало развертывания HR Desk..."

# Проверка наличия .env.prod
if [ ! -f "$PROJECT_DIR/.env.prod" ]; then
    echo "❌ Файл .env.prod не найден!"
    echo "📝 Создайте его на основе env.prod.sample и заполните необходимые переменные"
    exit 1
fi

# Переход в директорию проекта
cd "$PROJECT_DIR"

# Остановка существующих контейнеров
echo "🛑 Остановка существующих контейнеров..."
docker compose -f docker-compose.prod.yml down || true

# Сборка и запуск контейнеров
echo "🔨 Сборка и запуск контейнеров..."
docker compose -f docker-compose.prod.yml up -d --build

# Ожидание запуска сервисов
echo "⏳ Ожидание запуска сервисов..."
sleep 5

# Проверка статуса контейнеров
echo "📊 Проверка статуса контейнеров..."
docker compose -f docker-compose.prod.yml ps

# Проверка доступности backend
echo "🔍 Проверка доступности backend..."
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend доступен"
else
    echo "⚠️  Backend не отвечает, проверьте логи: docker compose -f docker-compose.prod.yml logs backend"
fi

# Проверка доступности frontend
echo "🔍 Проверка доступности frontend..."
if curl -f http://localhost:8080 > /dev/null 2>&1; then
    echo "✅ Frontend доступен"
else
    echo "⚠️  Frontend не отвечает, проверьте логи: docker compose -f docker-compose.prod.yml logs frontend"
fi

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Настройте nginx конфигурацию:"
echo "   sudo cp scripts/nginx-hrdesk.conf /etc/nginx/sites-available/hrdesk"
echo "   sudo ln -s /etc/nginx/sites-available/hrdesk /etc/nginx/sites-enabled/"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""
echo "2. Убедитесь, что домен hrdesk.teplocentral.local указывает на IP сервера"
echo ""
echo "3. Проверьте синхронизацию с SupporIT:"
echo "   curl -X GET http://localhost:8000/api/v1/integrations/supporit/health \\"
echo "     -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""
echo "📝 Логи:"
echo "   docker compose -f docker-compose.prod.yml logs -f"

