#!/bin/bash
# ============================================
# SupporIT Release Build Script
# ============================================
# Использование: ./scripts/build-release.sh [version]
# Пример: ./scripts/build-release.sh 1.1.0

set -e

# ===========================================
# КОНФИГУРАЦИЯ
# ===========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${PROJECT_DIR}/release-build"
RELEASES_DIR="${PROJECT_DIR}/releases"

# Версия из аргумента или из version.json
VERSION="${1:-$(grep -oP '"version"\s*:\s*"\K[^"]+' "${PROJECT_DIR}/version.json" 2>/dev/null || echo "1.0.0")}"

# ===========================================
# ЦВЕТА
# ===========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  echo -e "${BLUE}[BUILD]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[BUILD]${NC} ✅ $1"
}

log_error() {
  echo -e "${RED}[BUILD]${NC} ❌ $1"
}

log_warn() {
  echo -e "${YELLOW}[BUILD]${NC} ⚠️ $1"
}

# ===========================================
# ФУНКЦИИ
# ===========================================
clean() {
  log "Очистка предыдущей сборки..."
  rm -rf "$BUILD_DIR"
  mkdir -p "$BUILD_DIR"
  mkdir -p "$RELEASES_DIR"
}

build_frontend() {
  log "Сборка frontend..."
  cd "$PROJECT_DIR"

  # Устанавливаем зависимости если нужно
  if [ ! -d "node_modules" ]; then
    log "Установка зависимостей frontend..."
    npm ci
  fi

  # Сборка
  npm run build

  # Копируем в build директорию
  cp -r dist "${BUILD_DIR}/"

  log_success "Frontend собран"
}

build_backend() {
  log "Сборка backend..."
  cd "${PROJECT_DIR}/server"

  # Устанавливаем зависимости если нужно
  if [ ! -d "node_modules" ]; then
    log "Установка зависимостей backend..."
    npm ci
  fi

  # Сборка TypeScript
  npm run build

  # Создаем директорию server в build
  mkdir -p "${BUILD_DIR}/server"

  # Копируем собранные файлы
  cp -r dist "${BUILD_DIR}/server/"
  cp package.json "${BUILD_DIR}/server/"
  cp package-lock.json "${BUILD_DIR}/server/" 2>/dev/null || true

  log_success "Backend собран"
}

prepare_migrations() {
  log "Подготовка миграций..."

  mkdir -p "${BUILD_DIR}/supabase/migrations"

  # Копируем только миграции для текущей версии
  # Формат: YYYYMMDD_HHMMSS_vX.Y.Z_description.sql
  for migration in "${PROJECT_DIR}/supabase/migrations/"*"_v${VERSION}_"*.sql; do
    if [ -f "$migration" ]; then
      cp "$migration" "${BUILD_DIR}/supabase/migrations/"
      log "  Добавлена миграция: $(basename "$migration")"
    fi
  done

  # Если нет миграций для версии, проверяем новые миграции
  if [ -z "$(ls -A "${BUILD_DIR}/supabase/migrations" 2>/dev/null)" ]; then
    log_warn "Нет миграций для версии $VERSION"
  fi

  log_success "Миграции подготовлены"
}

prepare_scripts() {
  log "Подготовка скриптов..."

  mkdir -p "${BUILD_DIR}/scripts"

  # Копируем скрипты обновления
  cp "${PROJECT_DIR}/scripts/update.sh" "${BUILD_DIR}/scripts/"
  cp "${PROJECT_DIR}/scripts/rollback.sh" "${BUILD_DIR}/scripts/"

  # Делаем исполняемыми
  chmod +x "${BUILD_DIR}/scripts/"*.sh

  log_success "Скрипты подготовлены"
}

create_version_json() {
  log "Создание version.json..."

  local build_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local commit=$(git rev-parse --short HEAD 2>/dev/null || echo "")

  cat > "${BUILD_DIR}/version.json" << EOF
{
  "version": "${VERSION}",
  "build": "${build_date}",
  "commit": "${commit}",
  "minimumVersion": "1.0.0"
}
EOF

  log_success "version.json создан"
}

create_archive() {
  log "Создание архива..."

  local archive_name="supporit-v${VERSION}"
  local archive_path="${RELEASES_DIR}/${archive_name}.tar.gz"
  local checksum_path="${RELEASES_DIR}/${archive_name}.sha256"

  cd "$BUILD_DIR"

  # Переименовываем корневую директорию
  cd ..
  mv "$BUILD_DIR" "${PROJECT_DIR}/${archive_name}"

  # Создаем архив
  tar -czf "$archive_path" -C "$PROJECT_DIR" "$archive_name"

  # Возвращаем имя директории
  mv "${PROJECT_DIR}/${archive_name}" "$BUILD_DIR"

  # Создаем checksum
  sha256sum "$archive_path" | cut -d' ' -f1 > "$checksum_path"
  local checksum=$(cat "$checksum_path")

  log_success "Архив создан: $archive_path"
  log "Checksum: $checksum"

  echo "$archive_path"
}

create_changelog() {
  log "Создание CHANGELOG..."

  local changelog_path="${BUILD_DIR}/CHANGELOG.md"

  # Получаем последний тег
  local last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

  cat > "$changelog_path" << EOF
# SupporIT v${VERSION}

Release date: $(date +"%Y-%m-%d")

## Changes

EOF

  # Добавляем коммиты с последнего тега
  if [ -n "$last_tag" ]; then
    git log --oneline "${last_tag}..HEAD" 2>/dev/null >> "$changelog_path" || true
  else
    echo "Initial release" >> "$changelog_path"
  fi

  log_success "CHANGELOG создан"
}

# ===========================================
# MAIN
# ===========================================
main() {
  echo ""
  echo "=========================================="
  echo " SupporIT Release Builder"
  echo "=========================================="
  echo " Version: $VERSION"
  echo " Project: $PROJECT_DIR"
  echo "=========================================="
  echo ""

  # Проверяем что мы в корне проекта
  if [ ! -f "${PROJECT_DIR}/package.json" ]; then
    log_error "Запустите скрипт из корня проекта"
    exit 1
  fi

  clean
  build_frontend
  build_backend
  prepare_migrations
  prepare_scripts
  create_version_json
  create_changelog

  local archive_path=$(create_archive)

  echo ""
  echo "=========================================="
  log_success "СБОРКА ЗАВЕРШЕНА"
  echo "=========================================="
  echo ""
  echo "Релиз: $archive_path"
  echo "Checksum: ${RELEASES_DIR}/supporit-v${VERSION}.sha256"
  echo ""
  echo "Для публикации на GitHub:"
  echo "  1. Создайте тег: git tag v${VERSION}"
  echo "  2. Отправьте тег: git push origin v${VERSION}"
  echo "  3. Создайте релиз на GitHub и загрузите архив"
  echo ""
}

main "$@"
