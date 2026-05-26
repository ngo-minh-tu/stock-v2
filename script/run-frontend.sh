#!/usr/bin/env bash
# Chạy Next.js frontend. BE FastAPI phải chạy sẵn ở localhost:8000 (./script/run-backend.sh).
#
# Mode:
#   (mặc định)  dev — `next dev` (hot reload, compile-on-demand). Dùng khi code local.
#   --prod       production — `next build` + `next start`. Bundle nhỏ ~10×, không compile lag
#                lần đầu. Dùng khi share qua ngrok.
#   --rebuild    Bắt buộc build lại (chỉ áp dụng với --prod). Mặc định reuse `.next/` nếu có.
#
# Đổi port: PORT=3001 ./script/run-frontend.sh --prod
#hãy
# Ghi chú: không file data nào (DB, .env, telegram secret) bị động bởi build.
# `.next/` chỉ là JS bundle compile output.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FE_DIR="$ROOT_DIR/frontend"

cd "$FE_DIR"

MODE="dev"
FORCE_REBUILD=0
for arg in "$@"; do
  case "$arg" in
    --prod)    MODE="prod" ;;
    --rebuild) FORCE_REBUILD=1 ;;
    *) echo "[run-frontend] Unknown flag: $arg (allowed: --prod, --rebuild)" >&2; exit 1 ;;
  esac
done

if [ ! -d node_modules ]; then
  echo "[run-frontend] node_modules chưa có, chạy npm install..."
  npm install
fi

PORT="${PORT:-3000}"

free_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[run-frontend] Port $port đang bị giữ (PID: $(echo $pids | tr '\n' ' '))— kill để giải phóng..."
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "[run-frontend] Process còn sống, force kill -9..."
      kill -9 $pids 2>/dev/null || true
      sleep 1
    fi
  fi
}

free_port "$PORT"

if [ "$MODE" = "prod" ]; then
  if [ ! -f .next/BUILD_ID ] || [ "$FORCE_REBUILD" = "1" ]; then
    echo "[run-frontend] Production build (npm run build)... (~30-60s lần đầu)"
    npm run build
  else
    echo "[run-frontend] Reuse .next build cũ. Thêm --rebuild nếu vừa sửa code."
  fi
  echo "[run-frontend] Next.js PROD → http://localhost:$PORT"
  exec npm start -- -p "$PORT"
fi

echo "[run-frontend] Next.js DEV → http://localhost:$PORT"
exec npm run dev -- -p "$PORT"
