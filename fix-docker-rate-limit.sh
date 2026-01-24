#!/bin/bash

# =============================================================================
# Решение проблемы Docker Hub rate limit
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

info "=== Решение проблемы Docker Hub Rate Limit ==="
echo ""

echo "Выберите решение:"
echo "1) Войти в Docker Hub (рекомендуется - бесплатно)"
echo "2) Подождать и повторить позже (лимит сбрасывается каждые 6 часов)"
echo "3) Использовать зеркала Docker Hub"
echo ""
read -p "Ваш выбор (1-3): " choice

case $choice in
  1)
    info "Вариант 1: Аутентификация в Docker Hub"
    echo ""
    echo "Если у вас нет аккаунта Docker Hub:"
    echo "1. Зарегистрируйтесь на https://hub.docker.com/signup"
    echo "2. Подтвердите email"
    echo ""
    
    read -p "Введите ваш Docker Hub username: " docker_username
    
    if [ -z "$docker_username" ]; then
      error "Username не может быть пустым"
      exit 1
    fi
    
    info "Выполняем вход в Docker Hub..."
    docker login -u "$docker_username"
    
    if [ $? -eq 0 ]; then
      info "Успешно! Теперь вы можете делать до 200 pull-запросов каждые 6 часов"
      info "Запустите развертывание снова:"
      echo "  sudo ./deploy.sh"
    else
      error "Ошибка входа. Проверьте username и password"
      exit 1
    fi
    ;;
    
  2)
    warn "Вариант 2: Ожидание"
    echo ""
    echo "Лимит Docker Hub для анонимных пользователей:"
    echo "- 100 pull-запросов каждые 6 часов с одного IP"
    echo ""
    echo "Подождите несколько часов и попробуйте снова."
    echo "Или используйте вариант 1 (рекомендуется)"
    ;;
    
  3)
    info "Вариант 3: Использование зеркал"
    echo ""
    warn "Этот метод требует настройки Docker daemon"
    echo ""
    
    read -p "Продолжить? (y/n): " continue
    if [ "$continue" != "y" ]; then
      exit 0
    fi
    
    # Создаем конфигурацию Docker daemon
    DAEMON_CONFIG="/etc/docker/daemon.json"
    
    if [ -f "$DAEMON_CONFIG" ]; then
      warn "Файл $DAEMON_CONFIG уже существует"
      warn "Создаем резервную копию..."
      cp "$DAEMON_CONFIG" "${DAEMON_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    info "Настройка зеркал Docker Hub..."
    cat > "$DAEMON_CONFIG" << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.gcr.io",
    "https://daocloud.io",
    "https://docker.mirrors.ustc.edu.cn"
  ],
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 3
}
EOF
    
    info "Перезапуск Docker daemon..."
    systemctl restart docker
    
    if [ $? -eq 0 ]; then
      info "Зеркала настроены!"
      info "Запустите развертывание снова:"
      echo "  sudo ./deploy.sh"
    else
      error "Ошибка перезапуска Docker"
      exit 1
    fi
    ;;
    
  *)
    error "Неверный выбор"
    exit 1
    ;;
esac

echo ""
info "=== Готово ==="
