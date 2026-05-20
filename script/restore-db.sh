#!/usr/bin/env bash
# Restore SQLite DB from a backup created by backup-db.sh.
# Per Mốc 3 step 3 (Phase 18).
#
# Usage:
#   ./script/restore-db.sh <backup-file> [target-db-path]
#
# - Stop uvicorn BEFORE running this. Restore overwrites the live DB file.
# - The target path defaults to ./mvp/code/data/screener.db.
# - The current DB is renamed to <target>.pre-restore-<ts> before overwrite.

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <backup-file> [target-db-path]" >&2
    exit 1
fi

backup="$1"
target="${2:-./mvp/code/data/screener.db}"

if [[ ! -f "$backup" ]]; then
    echo "[restore-db] backup not found: $backup" >&2
    exit 1
fi

# Sanity check: backup must be a valid SQLite file
if ! sqlite3 "$backup" "PRAGMA integrity_check;" | head -1 | grep -q "^ok$"; then
    echo "[restore-db] backup integrity check FAILED for $backup" >&2
    exit 2
fi

# Refuse to overwrite a live DB (heuristic: WAL file presence + recent mtime)
if pgrep -f "uvicorn app.main:app" > /dev/null 2>&1; then
    echo "[restore-db] uvicorn is running — stop it before restoring" >&2
    exit 3
fi

if [[ -f "$target" ]]; then
    ts="$(date -u +%Y%m%dT%H%M%SZ)"
    preserve="${target}.pre-restore-${ts}"
    echo "[restore-db] preserving current DB → $preserve"
    mv "$target" "$preserve"
    # Also move WAL/SHM sidecars if present
    [[ -f "${target}-wal" ]] && mv "${target}-wal" "${preserve}-wal"
    [[ -f "${target}-shm" ]] && mv "${target}-shm" "${preserve}-shm"
fi

cp "$backup" "$target"
echo "[restore-db] restored $backup → $target"
echo "[restore-db] start uvicorn to verify"