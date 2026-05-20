#!/usr/bin/env bash
# Trigger POST /api/refresh/all on a running backend, for cron/systemd-timer use.
# Per Mốc 3 step 6 — TAD g05 §3 refresh schedule (16:30 ICT daily).
#
# Cron line (Asia/Ho_Chi_Minh = UTC+7 → 09:30 UTC):
#   30 9 * * 1-5  /srv/stock-screener/script/cron-refresh.sh
#
# Env (override via systemd EnvironmentFile or wrapper):
#   API_BASE       backend origin (default: http://localhost:8000)
#   API_PASSWORD   single-user MVP password (required)
#   LOG_FILE       append output to file (default: stderr)

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
API_PASSWORD="${API_PASSWORD:-}"

if [[ -z "$API_PASSWORD" ]]; then
    echo "[cron-refresh] API_PASSWORD env var required" >&2
    exit 1
fi

log() {
    if [[ -n "${LOG_FILE:-}" ]]; then
        echo "[$(date -u +%FT%TZ)] $*" >> "$LOG_FILE"
    else
        echo "[cron-refresh] $*" >&2
    fi
}

# Login
token=$(curl -s --fail-with-body -X POST "$API_BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"password\":\"${API_PASSWORD}\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

if [[ -z "$token" ]]; then
    log "login failed"
    exit 2
fi

# Trigger refresh (returns 202 + refresh_id immediately; BG task runs ~14 min)
resp=$(curl -s --fail-with-body -X POST "$API_BASE/api/refresh/all" \
    -H "Authorization: Bearer $token")
refresh_id=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['refresh_id'])")
log "triggered refresh_id=$refresh_id"

# Poll until terminal (max 30 min)
max_iter=60
for i in $(seq 1 $max_iter); do
    sleep 30
    status_json=$(curl -s --fail-with-body -H "Authorization: Bearer $token" \
        "$API_BASE/api/refresh/$refresh_id/status")
    status=$(echo "$status_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
    log "iter=$i status=$status"
    case "$status" in
        COMPLETED|COMPLETED_WITH_WARNINGS)
            log "done OK"
            exit 0
            ;;
        FAILED)
            log "refresh FAILED"
            exit 3
            ;;
    esac
done

log "timeout after ${max_iter} iterations"
exit 4