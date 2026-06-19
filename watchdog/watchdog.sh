#!/usr/bin/env bash
# Elements Platform — watchdog контейнер.
# Слушает Redis-очередь elements:updates:queue, при появлении задачи запускает update.sh.
set -euo pipefail

: "${BACKEND_URL:=http://backend:8000}"
: "${REDIS_QUEUE_KEY:=elements:updates:queue}"
: "${REDIS_PASSWORD:?REDIS_PASSWORD должен быть задан}"
: "${INTERNAL_UPDATE_TOKEN:?INTERNAL_UPDATE_TOKEN должен быть задан}"
: "${COMPOSE_FILE:=/workspace/docker-compose.prod.yml}"

REDIS_AUTH_ARGS=( -h redis -a "$REDIS_PASSWORD" --no-auth-warning )

post_status() {
    local task_id="$1"; shift
    local body="$1"; shift
    curl -fsS -X POST \
        -H "Content-Type: application/json" \
        -H "X-Internal-Token: $INTERNAL_UPDATE_TOKEN" \
        --data "$body" \
        "$BACKEND_URL/api/v1/platform/updates/internal/tasks/$task_id/status" \
        >/dev/null || echo "[watchdog] WARN: failed to push status for $task_id"
}
export -f post_status
export BACKEND_URL INTERNAL_UPDATE_TOKEN

echo "[watchdog] starting; backend=$BACKEND_URL; queue=$REDIS_QUEUE_KEY"

while true; do
    raw=$(redis-cli "${REDIS_AUTH_ARGS[@]}" --timeout 60 BRPOP "$REDIS_QUEUE_KEY" 30 || true)
    if [[ -z "$raw" ]]; then
        continue
    fi
    # BRPOP возвращает ключ + значение, нас интересует вторая строка
    payload=$(echo "$raw" | sed -n '2p')
    if [[ -z "$payload" ]]; then
        continue
    fi

    task_id=$(echo "$payload" | jq -r '.task_id // empty')
    version=$(echo "$payload" | jq -r '.version // empty')
    download_url=$(echo "$payload" | jq -r '.download_url // empty')
    sha256=$(echo "$payload" | jq -r '.sha256 // empty')

    if [[ -z "$task_id" || -z "$version" ]]; then
        echo "[watchdog] WARN: bad payload, skipping: $payload"
        continue
    fi

    echo "[watchdog] picked up task $task_id -> $version"
    if ! /app/update.sh "$task_id" "$version" "$download_url" "$sha256"; then
        echo "[watchdog] update.sh failed for $task_id"
    fi
done
