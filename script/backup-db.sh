#!/usr/bin/env bash
# SQLite hot backup using the .backup API — safe to run while uvicorn is serving.
# Per Mốc 3 step 3 (Phase 18). Schedule via cron, e.g.:
#   0 3 * * *  /srv/stock-screener/script/backup-db.sh
#
# Env (override via export or systemd EnvironmentFile):
#   DB_PATH          source DB path (default: ./mvp/code/data/screener.db)
#   BACKUP_DIR       destination dir (default: ./backups)
#   RETENTION_DAYS   delete backups older than N days (default: 14, 0 = keep all)

set -euo pipefail

DB_PATH="${DB_PATH:-./mvp/code/data/screener.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -f "$DB_PATH" ]]; then
    echo "[backup-db] source DB not found: $DB_PATH" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/screener-${ts}.db"

echo "[backup-db] source=$DB_PATH → out=$out"
# .backup uses SQLite's online backup API (read-locks pages, safe under WAL).
sqlite3 "$DB_PATH" ".backup '$out'"

# Verify the backup is a valid SQLite DB
if ! sqlite3 "$out" "PRAGMA integrity_check;" | head -1 | grep -q "^ok$"; then
    echo "[backup-db] integrity check FAILED for $out" >&2
    rm -f "$out"
    exit 2
fi

size=$(wc -c < "$out" | tr -d ' ')
echo "[backup-db] OK ($size bytes)"

if [[ "$RETENTION_DAYS" -gt 0 ]]; then
    deleted=$(find "$BACKUP_DIR" -name "screener-*.db" -type f -mtime "+${RETENTION_DAYS}" -delete -print | wc -l | tr -d ' ')
    if [[ "$deleted" -gt 0 ]]; then
        echo "[backup-db] purged $deleted backup(s) older than ${RETENTION_DAYS}d"
    fi
fi