#!/bin/bash
# ============================================
# SupporIT Rollback Script
# ============================================
# Использование: sudo ./scripts/rollback.sh [backup_dir]

set -e

# ===========================================
# КОНФИГУРАЦИЯ
# ===========================================
PROJECT_DIR="${PROJECT_DIR:-/opt/supporit}"
SERVICE_NAME="supporit-api"
LOG_DIR="/var/log/supporit"
LOG_FILE="${LOG_DIR}/rollback-$(date +%Y%m%d-%H%M%S).log"

# Backup директория (из аргумента или последний backup)
BACKUP_DIR="${1:-$(cat /tmp/supporit_last_backup 2>/dev/null)}"

# Загружаем переменные из .env если есть
if [ -f "${PROJECT_DIR}/server/.env" ]; then
  export $(grep -v '^#' "${PROJECT_DIR}/server/.env" | xargs)
fi

DB_NAME="${DB_NAME:-supporit}"
DB_USER="${DB_USER:-supporit_db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

# Парсинг DATABASE_URL если задан
if [ -n "$DATABASE_URL" ]; then
  DB_USER=$(echo $DATABASE_URL | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo $DATABASE_URL | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  DB_HOST=$(echo $DATABASE_URL | sed -n 's|.*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo $DATABASE_URL | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo $DATABASE_URL | sed -n 's|.*/\([^?]*\).*|\1|p')
fi

# ===========================================
# ФУНКЦИИ ЛОГИРОВАНИЯ
# ===========================================
mkdir -p "$LOG_DIR"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

log_error() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1"
  echo "$msg" | tee -a "$LOG_FILE" >&2
}

log_success() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

# ===========================================
# ПРОВЕРКИ
# ===========================================
check_prerequisites() {
  log "Проверка предусловий..."

  # Проверка root
  if [ "$EUID" -ne 0 ]; then
    log_error "Скрипт должен запускаться от root (sudo)"
    exit 1
  fi

  # Проверка backup директории
  if [ -z "$BACKUP_DIR" ]; then
    log_error "Не указана директория backup"
    log "Использование: $0 <backup_dir>"
    log ""
    log "Доступные backup'ы:"
    ls -la "${PROJECT_DIR}/backups/" 2>/dev/null || echo "  (нет backup'ов)"
    exit 1
  fi

  if [ ! -d "$BACKUP_DIR" ]; then
    log_error "Backup директория не найдена: $BACKUP_DIR"
    exit 1
  fi

  # Проверка наличия файлов backup
  if [ ! -f "${BACKUP_DIR}/database.sql" ]; then
    log_error "Дамп БД не найден в backup: ${BACKUP_DIR}/database.sql"
    exit 1
  fi

  log_success "Backup найден: $BACKUP_DIR"
}

# ===========================================
# ОТКАТ
# ===========================================
perform_rollback() {
  log "Начало отката к backup: $BACKUP_DIR"

  # Получаем версию из backup
  local old_version=""
  if [ -f "${BACKUP_DIR}/version.json" ]; then
    old_version=$(grep -oP '"version"\s*:\s*"\K[^"]+' "${BACKUP_DIR}/version.json" 2>/dev/null || echo "unknown")
    log "Версия в backup: $old_version"
  fi

  # Остановка сервиса
  log "Остановка сервиса ${SERVICE_NAME}..."
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  sleep 2

  # Восстановление файлов
  log "Восстановление файлов приложения..."

  # Frontend
  if [ -d "${BACKUP_DIR}/dist" ]; then
    rm -rf "${PROJECT_DIR}/dist"
    cp -r "${BACKUP_DIR}/dist" "${PROJECT_DIR}/"
    log "Frontend восстановлен"
  fi

  # Backend
  if [ -d "${BACKUP_DIR}/server-dist" ]; then
    rm -rf "${PROJECT_DIR}/server/dist"
    cp -r "${BACKUP_DIR}/server-dist" "${PROJECT_DIR}/server/dist"
    log "Backend восстановлен"
  fi

  # version.json
  if [ -f "${BACKUP_DIR}/version.json" ]; then
    cp "${BACKUP_DIR}/version.json" "${PROJECT_DIR}/"
  fi

  # Восстановление БД
  log "Восстановление базы данных..."
  log "ВНИМАНИЕ: Это полностью перезапишет текущую БД!"

  # Создаем новую БД или очищаем существующую
  if [ -n "$DB_PASS" ]; then
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "${BACKUP_DIR}/database.sql" >> "$LOG_FILE" 2>&1
  else
    sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
    sudo -u postgres psql -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || true
    sudo -u postgres psql -d "$DB_NAME" < "${BACKUP_DIR}/database.sql" >> "$LOG_FILE" 2>&1
  fi

  if [ $? -eq 0 ]; then
    log_success "База данных восстановлена"
  else
    log_error "Ошибка восстановления БД"
    exit 1
  fi

  # Установка прав
  if id "supporit" &>/dev/null; then
    chown -R supporit:supporit "${PROJECT_DIR}"
  fi

  # Запуск сервиса
  log "Запуск сервиса..."
  systemctl start "$SERVICE_NAME"

  # Проверка
  sleep 5
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    log_success "Сервис успешно запущен"
  else
    log_error "Сервис не запустился после отката!"
    log "Проверьте логи: journalctl -u $SERVICE_NAME -n 50"
    exit 1
  fi

  log_success "Откат завершен!"
  if [ -n "$old_version" ]; then
    log "Система восстановлена до версии: $old_version"
  fi
}

# ===========================================
# MAIN
# ===========================================
main() {
  log "=========================================="
  log "SupporIT Rollback Script"
  log "=========================================="
  log "Backup: $BACKUP_DIR"
  log ""

  # Подтверждение
  if [ -t 0 ]; then
    echo ""
    echo "ВНИМАНИЕ: Эта операция восстановит систему из backup."
    echo "Все изменения после создания backup будут потеряны!"
    echo ""
    read -p "Продолжить? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      log "Откат отменен пользователем"
      exit 0
    fi
  fi

  check_prerequisites
  perform_rollback

  log ""
  log "=========================================="
  log_success "ОТКАТ ЗАВЕРШЕН УСПЕШНО"
  log "=========================================="
  log "Лог отката: $LOG_FILE"
}

main "$@"
