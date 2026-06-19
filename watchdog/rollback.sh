#!/usr/bin/env bash
# Откат после неудачного обновления: git checkout PREV, восстановление БД, rebuild.
set -uo pipefail

TASK_ID="${1:?task_id}"
PREV_REF="${2:-}"

: "${COMPOSE_FILE:=/workspace/docker-compose.prod.yml}"
: "${WORKSPACE:=/workspace}"

echo "[rollback] task=$TASK_ID prev_ref=$PREV_REF"

post_status "$TASK_ID" '{"status":"rolled_back","log_append":"=== Откат запущен ==="}' || true

if [[ -n "$PREV_REF" ]]; then
    (cd "$WORKSPACE" && git checkout "$PREV_REF") || \
        post_status "$TASK_ID" '{"status":"rolled_back","log_append":"git checkout PREV_REF failed"}' || true
fi

# Восстановление БД из самого свежего бэкапа этой задачи
backup_file=$(ls -1t /backups/elements_pre_update_${TASK_ID}.sql.gz 2>/dev/null | head -1 || true)
if [[ -n "$backup_file" && -n "${DATABASE_URL:-}" ]]; then
    if ! (gunzip -c "$backup_file" | psql "$DATABASE_URL" >/tmp/restore.log 2>&1); then
        post_status "$TASK_ID" "$(jq -nc --arg l "psql restore FAILED: $(cat /tmp/restore.log | tail -10)" '{status:"rolled_back",log_append:$l}')" || true
    fi
fi

docker compose -f "$COMPOSE_FILE" up -d --build backend frontend || true
post_status "$TASK_ID" '{"status":"rolled_back","progress_percent":100,"log_append":"=== Откат завершён ==="}' || true
