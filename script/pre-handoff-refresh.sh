#!/usr/bin/env bash
# pre-handoff-refresh.sh — Phase 25 operator checklist trước khi ngrok hand-off.
#
# Mục đích: combine Phase 21 (no-downgrade upsert + multi-source merge) +
# Phase 22 (source-aware unit scaling) fix bằng cách WIPE financial_reports
# pre-Phase-22 (mix unit) rồi chạy full /refresh/all trên `prod-screener.db`.
#
# DESTRUCTIVE — phải có người vận hành review trước khi chạy.
# Script này IDEMPOTENT-ish: WIPE+REFRESH có thể chạy lại, nhưng MỖI lần ăn
# ~22 phút vnstock guest quota (26 ticker × 2 source × 4 sub-call × 6.5s).
#
# Env (override qua export):
#   APP_ENV       (default: production)
#   DB_PATH       (default: ./mvp/code/data/prod-screener.db)
#   API_BASE      (default: http://localhost:8000)
#   API_PASSWORD  (REQUIRED — login JWT)
#
# Run from repo root: `bash script/pre-handoff-refresh.sh`

set -euo pipefail

APP_ENV="${APP_ENV:-production}"
DB_PATH="${DB_PATH:-./mvp/code/data/prod-screener.db}"
API_BASE="${API_BASE:-http://localhost:8000}"
API_PASSWORD="${API_PASSWORD:-}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}/mvp/code"

if [[ -z "${API_PASSWORD}" ]]; then
  echo "FATAL: API_PASSWORD env var phải set (login JWT)." >&2
  exit 1
fi

if [[ ! -f "${REPO_ROOT}/${DB_PATH#./}" ]] && [[ ! -f "${DB_PATH}" ]]; then
  echo "FATAL: DB_PATH không tồn tại: ${DB_PATH}" >&2
  exit 1
fi

echo "==> Phase 25 pre-handoff refresh"
echo "    APP_ENV  = ${APP_ENV}"
echo "    DB_PATH  = ${DB_PATH}"
echo "    API_BASE = ${API_BASE}"
echo ""
read -r -p "Tiếp tục? Sẽ WIPE financial_reports + full /refresh/all (~22 phút). [y/N] " ans
if [[ ! "${ans}" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# 1. Backup DB (safety net) — same hot-backup API as script/backup-db.sh.
echo "==> [1/4] Backup DB hiện tại"
BACKUP_DIR="${REPO_ROOT}/backups"
mkdir -p "${BACKUP_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/prod-screener.db.pre-phase25.${STAMP}.bak"
sqlite3 "${DB_PATH}" ".backup '${BACKUP_FILE}'"
echo "    Saved: ${BACKUP_FILE}"

# 2. WIPE financial_reports (pre-Phase-22 mix-unit rows).
echo "==> [2/4] WIPE financial_reports rows pre-Phase-22"
APP_ENV="${APP_ENV}" DB_PATH="${DB_PATH}" PYTHONPATH=. uv run python -c "
from app.db.session import SessionLocal
from app.models.financial import FinancialReport
with SessionLocal() as db:
    n = db.query(FinancialReport).delete()
    db.commit()
    print(f'    Deleted {n} rows from financial_reports')
"

# 3. Trigger full /refresh/all.
echo "==> [3/4] Login + POST /api/refresh/all"
TOKEN="$(curl -fsS -X POST "${API_BASE}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"password\":\"${API_PASSWORD}\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")"

REFRESH_ID="$(curl -fsS -X POST "${API_BASE}/api/refresh/all" \
  -H "Authorization: Bearer ${TOKEN}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['refresh_id'])")"
echo "    refresh_id = ${REFRESH_ID}"
echo "    Polling status mỗi 30s (refresh ~22 phút)..."

while true; do
  STATUS_JSON="$(curl -fsS "${API_BASE}/api/refresh/${REFRESH_ID}/status" \
    -H "Authorization: Bearer ${TOKEN}")"
  STATUS="$(echo "${STATUS_JSON}" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['status'])")"
  echo "      [$(date -u +%H:%M:%S)] status=${STATUS}"
  if [[ "${STATUS}" == "COMPLETED" ]] || [[ "${STATUS}" == "FAILED" ]]; then
    break
  fi
  sleep 30
done

if [[ "${STATUS}" != "COMPLETED" ]]; then
  echo "FATAL: refresh terminal status = ${STATUS}. Check logs + restore backup nếu cần." >&2
  exit 1
fi

# 4. Audit — verify 26 real ticker đủ core BCTC fields.
echo "==> [4/4] Audit financial coverage"
APP_ENV="${APP_ENV}" DB_PATH="${DB_PATH}" PYTHONPATH=. uv run python -c "
from app.db.session import SessionLocal
from app.models.financial import FinancialReport
from sqlalchemy import select
with SessionLocal() as db:
    rows = db.execute(select(FinancialReport)).scalars().all()
    by_ticker = {}
    for r in rows: by_ticker.setdefault(r.ticker, []).append(r)
    ok_count = 0
    for ticker, rs in sorted(by_ticker.items()):
        latest = max(rs, key=lambda x: (x.year, x.quarter))
        ok = sum(1 for f in ['revenue','net_income','total_assets','total_equity','total_debt']
                 if getattr(latest, f))
        flag = '✅' if ok >= 4 else '⚠️ '
        print(f'    {flag} {ticker:6} {latest.period}: {ok}/5 core fields')
        if ok >= 4:
            ok_count += 1
    print(f'')
    print(f'    Coverage: {ok_count}/{len(by_ticker)} ticker đạt ≥4/5 core fields')
"

echo ""
echo "==> DONE. Verify dashboard + portfolio + news + run-history trước khi expose qua ngrok."
echo "    Nếu coverage <80%, kiểm cache_metadata.status (FRESH/PARTIAL) + logs."
echo "    Backup giữ tại: ${BACKUP_FILE}"
