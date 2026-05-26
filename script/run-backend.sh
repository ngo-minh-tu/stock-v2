# Terminal 1 — chạy backend FastAPI (real DB + real vnstock)
# ./script/run-backend.sh

# Terminal 2 — chạy frontend Next.js
# ./script/run-frontend.sh
# Đổi port nếu cần: PORT=8001 ./script/run-backend.sh

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BE_DIR="$ROOT_DIR/mvp/code"

cd "$BE_DIR"

if [ ! -f .env ]; then
  echo "[run-backend] .env chưa có — copy từ .env.example..."
  cp .env.example .env
  echo "[run-backend]  Edit $BE_DIR/.env: JWT_SECRET + INITIAL_USER_PASSWORD trước khi chạy lại."
  exit 1
fi

if [ ! -f data/screener.db ]; then
  echo "[run-backend] DB chưa có tại data/screener.db — chạy seed..."
  uv run python -m app.db.seed
fi

PORT="${PORT:-8000}"

free_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[run-backend] Port $port đang bị giữ (PID: $(echo $pids | tr '\n' ' '))— kill để giải phóng..."
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "[run-backend] Process còn sống, force kill -9..."
      kill -9 $pids 2>/dev/null || true
      sleep 1
    fi
  fi
}

free_port "$PORT"

echo "[run-backend] FastAPI → http://localhost:$PORT"
exec uv run uvicorn app.main:app --host 127.0.0.1 --port "$PORT"