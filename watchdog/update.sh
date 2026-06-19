#!/usr/bin/env bash
# Выполняет одну задачу обновления.
set -uo pipefail

TASK_ID="${1:?task_id}"
VERSION="${2:?version}"
DOWNLOAD_URL="${3:-}"
SHA256="${4:-}"

: "${COMPOSE_FILE:=/workspace/docker-compose.prod.yml}"
: "${WORKSPACE:=/workspace}"

current_ref=$(cd "$WORKSPACE" && git rev-parse HEAD 2>/dev/null || echo "")

push() {
    local body="$1"
    post_status "$TASK_ID" "$body"
}

fail() {
    local msg="$1"
    push "$(jq -nc --arg s failed --arg e "$msg" --arg l "FAILED: $msg" '{status:$s,error:$e,log_append:$l}')"
    /app/rollback.sh "$TASK_ID" "$current_ref" || true
}

trap 'fail "watchdog получил сигнал прерывания"' INT TERM

# ============================================================================
# 1. backing_up
# ============================================================================
push '{"status":"backing_up","progress_percent":5,"log_append":"=== Создание резервной копии БД ==="}'

backup_dir="/backups"
mkdir -p "$backup_dir"
backup_file="$backup_dir/elements_pre_update_${TASK_ID}.sql.gz"

if ! pg_dump "${DATABASE_URL:?DATABASE_URL не задан}" 2>/tmp/pgdump.log | gzip > "$backup_file"; then
    fail "pg_dump failed: $(cat /tmp/pgdump.log | head -20)"
    exit 1
fi

push "$(jq -nc --arg p "$backup_file" --arg log "Backup: $backup_file" \
    '{status:"backing_up",progress_percent:15,backup_path:$p,log_append:$log}')"

# ============================================================================
# 2. pulling
# ============================================================================
push '{"status":"pulling","progress_percent":25,"log_append":"=== Получение релиза ==="}'

cd "$WORKSPACE"

if [[ -n "$DOWNLOAD_URL" ]]; then
    tmp_archive="/tmp/elements_${VERSION}.tar.gz"
    if ! curl -fsSL "$DOWNLOAD_URL" -o "$tmp_archive"; then
        fail "Не удалось скачать $DOWNLOAD_URL"
        exit 1
    fi
    if [[ -n "$SHA256" ]]; then
        actual=$(sha256sum "$tmp_archive" | awk '{print $1}')
        if [[ "$actual" != "$SHA256" ]]; then
            fail "SHA256 не совпал: ожидалось $SHA256, получено $actual"
            exit 1
        fi
    fi
    if ! tar -xzf "$tmp_archive" -C "$WORKSPACE"; then
        fail "Не удалось распаковать архив"
        exit 1
    fi
else
    if ! git fetch --tags; then
        fail "git fetch failed"
        exit 1
    fi
    target_ref="v${VERSION}"
    if ! git rev-parse --verify "$target_ref" >/dev/null 2>&1; then
        target_ref="$VERSION"
    fi
    if ! git checkout "$target_ref"; then
        fail "git checkout $target_ref failed"
        exit 1
    fi
fi

push '{"status":"building","progress_percent":50,"log_append":"=== Пересборка контейнеров ==="}'

# ============================================================================
# 3. building
# ============================================================================
if ! docker compose -f "$COMPOSE_FILE" up -d --build backend frontend; then
    fail "docker compose up failed"
    exit 1
fi

push '{"status":"migrating","progress_percent":75,"log_append":"=== Ожидание health backend ==="}'

# ============================================================================
# 4. migrating (миграции выполняются на старте backend)
# ============================================================================
for i in $(seq 1 60); do
    if curl -fsS "$BACKEND_URL/health" >/dev/null 2>&1; then
        break
    fi
    sleep 5
done

if ! curl -fsS "$BACKEND_URL/health" >/dev/null 2>&1; then
    fail "Backend не отвечает после рестарта"
    exit 1
fi

# Финальная проверка версии
reported_version=$(curl -fsS "$BACKEND_URL/health" | jq -r '.version // ""')
if [[ -n "$reported_version" && "$reported_version" != "$VERSION" ]]; then
    push "$(jq -nc --arg v "$reported_version" --arg req "$VERSION" \
        '{status:"failed",error:("Backend сообщает версию "+$v+", ожидалась "+$req),log_append:"VERSION MISMATCH"}')"
    /app/rollback.sh "$TASK_ID" "$current_ref" || true
    exit 1
fi

push '{"status":"done","progress_percent":100,"log_append":"=== Обновление завершено успешно ==="}'
echo "[update] task $TASK_ID done -> $VERSION"
