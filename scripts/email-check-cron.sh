#!/bin/bash
# =============================================================================
# Elements Platform - Cron: проверка почтового ящика (check-inbox)
# =============================================================================
# Вызывается по крону каждые 5 минут. Логинится, получает JWT, дергает
# POST /api/v1/it/email/check-inbox. Использует .env.production (SEED_ADMIN_*).
# =============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env.production"

if [ ! -f "$ENV_FILE" ]; then
    echo "elements email-check-cron: .env.production not found" >&2
    exit 1
fi

# Загружаем только нужные переменные (без eval всего файла)
export SEED_ADMIN_EMAIL=""
export SEED_ADMIN_PASSWORD=""
export HTTP_PORT="80"
while IFS= read -r line; do
    case "$line" in
        SEED_ADMIN_EMAIL=*) export SEED_ADMIN_EMAIL="${line#*=}" ;;
        SEED_ADMIN_PASSWORD=*) export SEED_ADMIN_PASSWORD="${line#*=}" ;;
        HTTP_PORT=*) export HTTP_PORT="${line#*=}" ;;
    esac
done < <(grep -E '^SEED_ADMIN_EMAIL=|^SEED_ADMIN_PASSWORD=|^HTTP_PORT=' "$ENV_FILE" | sed 's/[[:space:]]*#.*//; s/^[[:space:]]*//; s/[[:space:]]*$//')

# Убираем кавычки вокруг значений, если есть
SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL%\"}"; SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL#\"}"
SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD%\"}"; SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD#\"}"
HTTP_PORT="${HTTP_PORT%\"}"; HTTP_PORT="${HTTP_PORT#\"}"
[ -z "$HTTP_PORT" ] && HTTP_PORT="80"

if [ -z "$SEED_ADMIN_EMAIL" ] || [ -z "$SEED_ADMIN_PASSWORD" ]; then
    echo "elements email-check-cron: SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not set" >&2
    exit 1
fi

API_BASE="http://127.0.0.1:${HTTP_PORT}/api/v1"
# Экранируем кавычки и обратные слэши в JSON
esc_email="$(echo "$SEED_ADMIN_EMAIL" | sed 's/\\/\\\\/g; s/"/\\"/g')"
esc_pass="$(echo "$SEED_ADMIN_PASSWORD" | sed 's/\\/\\\\/g; s/"/\\"/g')"
JSON="{\"email\":\"$esc_email\",\"password\":\"$esc_pass\"}"

LOGIN_RESP="$(curl -s -X POST "${API_BASE}/auth/login" -H "Content-Type: application/json" -d "$JSON")"
TOKEN="$(echo "$LOGIN_RESP" | grep -o '"access_token":"[^"]*"' | head -1 | sed 's/"access_token":"//; s/"$//')"

if [ -z "$TOKEN" ]; then
    echo "elements email-check-cron: login failed, no access_token" >&2
    exit 1
fi

OUT=$(mktemp)
HTTP=$(curl -s -o "$OUT" -w "%{http_code}" -X POST "${API_BASE}/it/email/check-inbox" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")
if [ "$HTTP" -lt 200 ] || [ "$HTTP" -ge 300 ]; then
    echo "elements email-check-cron: check-inbox failed HTTP $HTTP" >&2
    [ -s "$OUT" ] && cat "$OUT" >&2
    rm -f "$OUT"
    exit 1
fi
rm -f "$OUT"
