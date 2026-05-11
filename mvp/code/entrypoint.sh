#!/bin/sh
set -e

# Ensure data dir exists (volume mount may be empty on first run)
mkdir -p "$(dirname "${DB_PATH:-/app/data/screener.db}")"

# Apply pending migrations (MVP: gộp vào boot — prod sẽ tách step)
echo "[entrypoint] Running alembic upgrade head..."
alembic upgrade head

echo "[entrypoint] Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
