#!/usr/bin/env bash
# Phase 19 — Start backend in demo+stub mode for Playwright E2E.
# Seeds the demo DB if missing, then exec uvicorn on :8000.
# Idempotent: re-running is safe (demo_seed rebuilds run_demo_latest).

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "${SCRIPT_DIR}/.." && pwd )"
CODE_DIR="${REPO_ROOT}/mvp/code"

cd "${CODE_DIR}"

export APP_ENV="${APP_ENV:-demo}"
export DB_PATH="${DB_PATH:-./data/demo-screener.db}"
export VNSTOCK_CLIENT_STUB="${VNSTOCK_CLIENT_STUB:-true}"
export EXPORT_PDF_MODE="${EXPORT_PDF_MODE:-html_mock}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:3000}"
export JWT_SECRET="${JWT_SECRET:-e2e-only-secret-min-32-chars-xxxxxxxxxxxx}"
export INITIAL_USER_PASSWORD="${INITIAL_USER_PASSWORD:-ChangeMe123!}"

if [[ ! -f "${DB_PATH#./}" && ! -f "${DB_PATH}" ]]; then
  echo "[e2e] demo DB missing at ${DB_PATH} — running demo_seed"
  uv run python -m app.db.demo_seed
else
  echo "[e2e] demo DB found at ${DB_PATH}"
fi

PORT="${PORT:-8000}"
echo "[e2e] starting uvicorn on :${PORT} (APP_ENV=${APP_ENV}, stub=${VNSTOCK_CLIENT_STUB})"
exec uv run uvicorn app.main:app --host 127.0.0.1 --port "${PORT}"
