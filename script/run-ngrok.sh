# Terminal 1 — chạy prototype
# ./script/run-prototype.sh

# Terminal 2 — expose ra internet
# ./script/run-ngrok.sh
# Đổi port nếu cần: PORT=3001 ./script/run-prototype.sh rồi PORT=3001 ./script/run-ngrok.sh.

#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "[run-ngrok] Lỗi: chưa cài ngrok. Cài bằng: brew install ngrok/ngrok/ngrok" >&2
  exit 1
fi

echo "[run-ngrok] Expose http://localhost:$PORT qua ngrok..."
exec ngrok http "$PORT"
