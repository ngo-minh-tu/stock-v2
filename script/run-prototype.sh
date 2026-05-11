# Terminal 1 — chạy prototype
# ./script/run-prototype.sh

# Terminal 2 — expose ra internet
# ./script/run-ngrok.sh
# Đổi port nếu cần: PORT=3001 ./script/run-prototype.sh rồi PORT=3001 ./script/run-ngrok.sh.

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR/prototype"

if [ ! -d node_modules ]; then
  echo "[run-prototype] node_modules chưa có, chạy npm install..."
  npm install
fi

PORT="${PORT:-3000}"
echo "[run-prototype] Next.js dev → http://localhost:$PORT"
exec npm run dev -- -p "$PORT"
