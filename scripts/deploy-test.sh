#!/bin/bash
# =============================================================================
# Elements Platform - Скрипт развёртывания тестового окружения
# =============================================================================
# Использование:
#   ./scripts/deploy-test.sh          # Полное развёртывание
#   ./scripts/deploy-test.sh rebuild  # Пересборка контейнеров
#   ./scripts/deploy-test.sh down     # Остановка
#   ./scripts/deploy-test.sh clean    # Полная очистка (с удалением данных)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.test.yml"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker не установлен"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose не установлен"
        exit 1
    fi

    log_success "Docker и Docker Compose найдены"
}

# Определяем команду docker-compose
get_compose_cmd() {
    if docker compose version &> /dev/null 2>&1; then
        echo "docker compose"
    else
        echo "docker-compose"
    fi
}

COMPOSE_CMD=$(get_compose_cmd)

# Запуск инфраструктуры
start_infrastructure() {
    log_info "Запуск инфраструктуры (PostgreSQL, Redis, RabbitMQ, MinIO)..."

    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d postgres redis rabbitmq minio

    log_info "Ожидание готовности PostgreSQL..."
    sleep 5

    # Ждём пока PostgreSQL станет доступен
    for i in {1..30}; do
        if $COMPOSE_CMD -f "$COMPOSE_FILE" exec -T postgres pg_isready -U elements -d elements &> /dev/null; then
            log_success "PostgreSQL готов"
            return 0
        fi
        echo -n "."
        sleep 1
    done

    log_error "PostgreSQL не запустился за 30 секунд"
    exit 1
}

# Запуск приложений
start_applications() {
    log_info "Запуск Elements HR..."

    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d backend-hr frontend-hr

    log_info "Ожидание готовности HR backend..."
    sleep 5

    # Ждём пока backend станет доступен
    for i in {1..30}; do
        if curl -s http://localhost:8001/health &> /dev/null; then
            log_success "HR Backend готов"
            break
        fi
        echo -n "."
        sleep 1
    done
}

# Вывод информации о доступе
print_access_info() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}Тестовое окружение Elements запущено!${NC}"
    echo "=============================================="
    echo ""
    echo "Доступные сервисы:"
    echo ""
    echo -e "  ${BLUE}Elements HR Frontend:${NC}  http://localhost:8081"
    echo -e "  ${BLUE}Elements HR API:${NC}       http://localhost:8001/api/v1"
    echo -e "  ${BLUE}API Документация:${NC}      http://localhost:8001/docs"
    echo ""
    echo "  PostgreSQL:            localhost:5433"
    echo "  Redis:                 localhost:6380"
    echo "  RabbitMQ Management:   http://localhost:15673"
    echo "  MinIO Console:         http://localhost:9003"
    echo ""
    echo "Учётные данные:"
    echo ""
    echo -e "  ${YELLOW}HR Admin:${NC}"
    echo "    Email:    admin@test.local"
    echo "    Password: test123"
    echo ""
    echo "  RabbitMQ: elements / elements_test_pwd"
    echo "  MinIO:    elements / elements_test_pwd"
    echo ""
    echo "Команды:"
    echo ""
    echo "  Логи:     docker-compose -f docker-compose.test.yml logs -f"
    echo "  Стоп:     ./scripts/deploy-test.sh down"
    echo "  Очистка:  ./scripts/deploy-test.sh clean"
    echo ""
}

# Остановка
stop_all() {
    log_info "Остановка тестового окружения..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" down
    log_success "Тестовое окружение остановлено"
}

# Полная очистка
clean_all() {
    log_warning "Это удалит ВСЕ данные тестового окружения!"
    read -p "Продолжить? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Остановка и удаление контейнеров и данных..."
        $COMPOSE_CMD -f "$COMPOSE_FILE" down -v --remove-orphans
        log_success "Тестовое окружение полностью очищено"
    else
        log_info "Отменено"
    fi
}

# Пересборка
rebuild() {
    log_info "Пересборка контейнеров..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache
    $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
    log_success "Контейнеры пересобраны и запущены"
}

# Main
cd "$PROJECT_DIR"

case "${1:-}" in
    down)
        check_docker
        stop_all
        ;;
    clean)
        check_docker
        clean_all
        ;;
    rebuild)
        check_docker
        rebuild
        print_access_info
        ;;
    *)
        check_docker
        start_infrastructure
        start_applications
        print_access_info
        ;;
esac
