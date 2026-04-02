#!/bin/bash
# ============================================
# SupporIT Auto-Update Script
# ============================================
# Использование: sudo ./scripts/update.sh <archive_path> <backup_dir>

set -e

# ===========================================
# КОНФИГУРАЦИЯ
# ===========================================
PROJECT_DIR="${PROJECT_DIR:-/opt/supporit}"
BACKUP_DIR="${2:-/opt/supporit/backups}"
ARCHIVE_PATH="$1"
LOG_DIR="/var/log/supporit"
LOG_FILE="${LOG_DIR}/update-$(date +%Y%m%d-%H%M%S).log"
SERVICE_NAME="supporit-api"

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

  # Проверка архива
  if [ -z "$ARCHIVE_PATH" ]; then
    log_error "Не указан путь к архиву обновления"
    log "Использование: $0 <archive_path> [backup_dir]"
    exit 1
  fi

  if [ ! -f "$ARCHIVE_PATH" ]; then
    log_error "Архив не найден: $ARCHIVE_PATH"
    exit 1
  fi

  # Проверка директории проекта
  if [ ! -d "$PROJECT_DIR" ]; then
    log_error "Директория проекта не найдена: $PROJECT_DIR"
    exit 1
  fi

  log_success "Все проверки пройдены"
}

# ===========================================
# BACKUP
# ===========================================
create_backup() {
  log "Создание резервной копии..."

  local timestamp=$(date +%Y%m%d-%H%M%S)
  local backup_subdir="${BACKUP_DIR}/${timestamp}"
  mkdir -p "$backup_subdir"

  # Backup текущих файлов
  log "Копирование файлов приложения..."
  if [ -d "${PROJECT_DIR}/dist" ]; then
    cp -r "${PROJECT_DIR}/dist" "${backup_subdir}/" 2>/dev/null || true
  fi

  if [ -d "${PROJECT_DIR}/server/dist" ]; then
    cp -r "${PROJECT_DIR}/server/dist" "${backup_subdir}/server-dist/" 2>/dev/null || true
  fi

  if [ -f "${PROJECT_DIR}/version.json" ]; then
    cp "${PROJECT_DIR}/version.json" "${backup_subdir}/" 2>/dev/null || true
  fi

  # Backup БД
  log "Создание дампа базы данных..."
  if [ -n "$DB_PASS" ]; then
    PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "${backup_subdir}/database.sql" 2>/dev/null
  else
    sudo -u postgres pg_dump "$DB_NAME" > "${backup_subdir}/database.sql" 2>/dev/null
  fi

  if [ $? -eq 0 ]; then
    log_success "Дамп БД создан"
  else
    log "WARN: Не удалось создать дамп БД"
  fi

  # Сохраняем путь к backup
  echo "$backup_subdir" > /tmp/supporit_last_backup

  log_success "Backup создан: $backup_subdir"
  echo "$backup_subdir"
}

# ===========================================
# МИГРАЦИИ
# ===========================================
apply_migrations() {
  local release_dir="$1"
  local migrations_dir="${release_dir}/supabase/migrations"

  log "Проверка миграций БД..."

  if [ ! -d "$migrations_dir" ]; then
    log "Нет новых миграций в релизе"
    return 0
  fi

  # Проверяем существует ли таблица schema_migrations
  local table_exists
  if [ -n "$DB_PASS" ]; then
    table_exists=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_migrations')" 2>/dev/null)
  else
    table_exists=$(sudo -u postgres psql -d "$DB_NAME" -tAc \
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_migrations')" 2>/dev/null)
  fi

  if [ "$table_exists" != "t" ]; then
    log "Таблица schema_migrations не существует, создаем..."
  fi

  # Получаем список уже примененных миграций
  local applied=""
  if [ "$table_exists" = "t" ]; then
    if [ -n "$DB_PASS" ]; then
      applied=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
        "SELECT filename FROM schema_migrations WHERE success = true" 2>/dev/null || echo "")
    else
      applied=$(sudo -u postgres psql -d "$DB_NAME" -tAc \
        "SELECT filename FROM schema_migrations WHERE success = true" 2>/dev/null || echo "")
    fi
  fi

  # Применяем миграции
  local migration_count=0
  for migration in "$migrations_dir"/*.sql; do
    if [ -f "$migration" ]; then
      local filename=$(basename "$migration")

      # Пропускаем если уже применена
      if echo "$applied" | grep -q "$filename"; then
        log "Миграция уже применена: $filename"
        continue
      fi

      log "Применение миграции: $filename"

      local start_time=$(date +%s%N)
      local checksum=$(sha256sum "$migration" | cut -d' ' -f1)
      local version=$(echo "$filename" | grep -oP 'v\d+\.\d+\.\d+' || echo "unknown")

      local result=0
      if [ -n "$DB_PASS" ]; then
        PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration" >> "$LOG_FILE" 2>&1 || result=$?
      else
        sudo -u postgres psql -d "$DB_NAME" -f "$migration" >> "$LOG_FILE" 2>&1 || result=$?
      fi

      local end_time=$(date +%s%N)
      local duration_ms=$(( (end_time - start_time) / 1000000 ))

      if [ $result -eq 0 ]; then
        # Записываем успех
        local insert_sql="INSERT INTO schema_migrations (filename, version, checksum, execution_time_ms, success) VALUES ('$filename', '$version', '$checksum', $duration_ms, true)"
        if [ -n "$DB_PASS" ]; then
          PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$insert_sql" 2>/dev/null || true
        else
          sudo -u postgres psql -d "$DB_NAME" -c "$insert_sql" 2>/dev/null || true
        fi
        log_success "Миграция применена: $filename (${duration_ms}ms)"
        ((migration_count++))
      else
        # Записываем ошибку
        local insert_sql="INSERT INTO schema_migrations (filename, version, checksum, success, error_message) VALUES ('$filename', '$version', '$checksum', false, 'See update log')"
        if [ -n "$DB_PASS" ]; then
          PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$insert_sql" 2>/dev/null || true
        else
          sudo -u postgres psql -d "$DB_NAME" -c "$insert_sql" 2>/dev/null || true
        fi
        log_error "Ошибка миграции: $filename"
        return 1
      fi
    fi
  done

  if [ $migration_count -gt 0 ]; then
    log_success "Применено миграций: $migration_count"
  else
    log "Новых миграций не найдено"
  fi
}

# ===========================================
# ОБНОВЛЕНИЕ
# ===========================================
deploy_update() {
  log "Развертывание обновления..."

  local extract_dir="/tmp/supporit-update-$$"
  mkdir -p "$extract_dir"

  # Распаковка
  log "Распаковка архива..."
  tar -xzf "$ARCHIVE_PATH" -C "$extract_dir"

  # Находим директорию с релизом
  local release_dir=$(find "$extract_dir" -maxdepth 1 -type d -name "supporit-*" | head -1)

  if [ -z "$release_dir" ]; then
    # Возможно файлы в корне архива
    release_dir="$extract_dir"
  fi

  log "Директория релиза: $release_dir"

  # Проверяем version.json
  if [ ! -f "${release_dir}/version.json" ]; then
    log_error "version.json не найден в релизе"
    rm -rf "$extract_dir"
    exit 1
  fi

  local new_version=$(grep -oP '"version"\s*:\s*"\K[^"]+' "${release_dir}/version.json")
  log "Новая версия: $new_version"

  # Остановка сервиса
  log "Остановка сервиса ${SERVICE_NAME}..."
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  sleep 2

  # Применение миграций (до копирования файлов)
  apply_migrations "$release_dir"

  # Копирование файлов
  log "Копирование новых файлов..."

  # Frontend
  if [ -d "${release_dir}/dist" ]; then
    rm -rf "${PROJECT_DIR}/dist"
    cp -r "${release_dir}/dist" "${PROJECT_DIR}/"
    log "Frontend обновлен"
  fi

  # Backend
  if [ -d "${release_dir}/server/dist" ]; then
    rm -rf "${PROJECT_DIR}/server/dist"
    cp -r "${release_dir}/server/dist" "${PROJECT_DIR}/server/"
    log "Backend обновлен"
  fi

  # version.json
  cp "${release_dir}/version.json" "${PROJECT_DIR}/"

  # Скрипты (если есть новые)
  if [ -d "${release_dir}/scripts" ]; then
    cp -r "${release_dir}/scripts/"* "${PROJECT_DIR}/scripts/" 2>/dev/null || true
    chmod +x "${PROJECT_DIR}/scripts/"*.sh 2>/dev/null || true
    log "Скрипты обновлены"
  fi

  # Обновление npm зависимостей если изменился package.json
  if [ -f "${release_dir}/server/package.json" ]; then
    log "Проверка зависимостей..."
    cd "${PROJECT_DIR}/server"
    npm ci --production --silent 2>/dev/null || npm install --production --silent 2>/dev/null || true
    cd - > /dev/null
  fi

  # Обновление версии в БД
  log "Обновление версии в БД..."
  local update_sql="UPDATE system_info SET current_version = '$new_version', last_update_at = NOW() WHERE id = 1"
  if [ -n "$DB_PASS" ]; then
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$update_sql" 2>/dev/null || true
  else
    sudo -u postgres psql -d "$DB_NAME" -c "$update_sql" 2>/dev/null || true
  fi

  # Установка прав
  if id "supporit" &>/dev/null; then
    chown -R supporit:supporit "${PROJECT_DIR}"
  fi

  # Запуск сервиса
  log "Запуск сервиса..."
  systemctl start "$SERVICE_NAME"

  # Проверка здоровья
  sleep 5
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    log_success "Сервис успешно запущен"

    # Дополнительная проверка health endpoint
    local health_check=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT:-3001}/health" 2>/dev/null || echo "000")
    if [ "$health_check" = "200" ]; then
      log_success "Health check пройден"
    else
      log "WARN: Health check вернул код $health_check"
    fi
  else
    log_error "Сервис не запустился!"
    log "Проверьте логи: journalctl -u $SERVICE_NAME -n 50"
    rm -rf "$extract_dir"
    exit 1
  fi

  # Очистка
  rm -rf "$extract_dir"

  log_success "Обновление до версии $new_version завершено!"
}

# ===========================================
# MAIN
# ===========================================
main() {
  log "=========================================="
  log "SupporIT Update Script"
  log "=========================================="
  log "Архив: $ARCHIVE_PATH"
  log "Backup директория: $BACKUP_DIR"
  log ""

  check_prerequisites

  # Создаем backup
  local backup_path=$(create_backup)

  # Выполняем обновление
  deploy_update

  log ""
  log "=========================================="
  log_success "ОБНОВЛЕНИЕ ЗАВЕРШЕНО УСПЕШНО"
  log "=========================================="
  log "Backup сохранен в: $backup_path"
  log "Лог обновления: $LOG_FILE"
}

main "$@"
