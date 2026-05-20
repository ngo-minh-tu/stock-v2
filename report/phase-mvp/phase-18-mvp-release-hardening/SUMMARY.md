# Phase 18 — MVP Release Hardening (Mốc 3, steps 2-7)

**Ngày:** 2026-05-20
**Mục tiêu thực hiện:** đóng Mốc 3 phần backend hardening + tooling production: vnstock quota fix, prod env template, SQLite backup/restore, cron refresh script, PDF/Telegram verify, security audit.
**Trạng thái:** COMPLETED 2026-05-20

## 1. Việc đã làm

- **Step 2 — Vnstock quota hardening**:
  - Phát hiện vnstock guest quota = 20 req/min, nhưng BCTC = 4 sub-call/ticker (income/balance/cash/ratio) → per-ticker gating cũ để burst vượt quota.
  - Thêm per-sub-call `_gate_wait()` trong `_fetch_financials_source()` (4 lần gate cho mỗi ticker BCTC).
  - Remove `_gate_wait()` ngoài loop trong `fetch_financials()` (inner gates đã cover boundary).
  - Trade-off: refresh thời gian tăng từ 7 phút → ~14 phút cho 26 ticker; đổi lại đạt `vnstock_financial=FRESH` consistently.
- **Step 2b — Bulk_upsert TIG bug**:
  - Phát hiện run /refresh/all đầu sau gating fix: 25/26 BCTC success, chỉ TIG fail.
  - Root cause: TIG row 2025Q1 thiếu `total_equity` field (chỉ 9 keys vs 15 keys của các row khác); SQLAlchemy `sqlite_insert(...).values([heterogeneous_rows])` không bind được column thiếu khi không có Python-side default.
  - Fix: `financial_repo.bulk_upsert()` normalize mọi row về cùng key set với `None` cho field thiếu.
- **Step 3 — Production env config + backup/restore**:
  - Thêm `env.production.example` template với `JWT_SECRET=CHANGE_ME_RUN_openssl_rand_hex_32_xxx` và `INITIAL_USER_PASSWORD=CHANGE_ME_BEFORE_FIRST_BOOT`, comments rõ ràng cho từng group.
  - `script/backup-db.sh` dùng SQLite hot `.backup` API (WAL-safe khi uvicorn đang serve), integrity check sau backup, retention N ngày configurable.
  - `script/restore-db.sh` với pre-restore snapshot (`screener.db.pre-restore-<ts>`), refuse khi uvicorn đang chạy, integrity check trước restore.
  - Smoke test backup script trên prod-screener.db: 1.2MB backup OK, integrity pass.
- **Step 4 — Telegram endpoint contract verify**:
  - Curl `POST /api/telegram/test` với empty creds → trả `{success:true, data:{sent:false, error:"Telegram chưa cấu hình..."}}`. Envelope pattern đúng theo Phase 8 convention.
  - Real-send cần user-side cấp Bot token + chat ID, chuyển sang hand-off.
- **Step 5 — PDF export check**:
  - Curl `GET /api/export/pdf/{run_id}` với token → HTTP 200, `Content-Type: application/pdf`, size 28998 bytes.
  - File magic `%PDF-1.7`, `file` xác nhận PDF document version 1.7.
  - WeasyPrint mode default hoạt động bình thường; html_mock mode là auto-fallback nếu weasyprint fail (Phase 8 logic).
- **Step 6 — Cron refresh schedule**:
  - `script/cron-refresh.sh` dùng curl login → POST /api/refresh/all → poll status 30s/iter (max 30 phút).
  - Env vars `API_BASE`, `API_PASSWORD`, optional `LOG_FILE`.
  - Document cron line cho TAD g05 §3 (16:30 ICT = 09:30 UTC weekday): `30 9 * * 1-5 /srv/stock-screener/script/cron-refresh.sh`.
- **Step 7 — Security audit**:
  - BE: `uv pip install pip-audit && uv run pip-audit --strict` → 1 vuln (idna 3.13 CVE-2026-45409).
  - Fix BE: `uv lock --upgrade-package idna && uv sync --frozen` → idna 3.13 → 3.15. Re-audit: 0 vulns.
  - FE: `npm audit --production` → 3 vulns (1 critical next + 2 moderate next-intl + postcss). Tất cả cần Next 16 breaking upgrade. DEFER vì cần regression cycle riêng, ghi vào hand-off Phase 19.
- Verify regression sau từng fix:
  - Targeted pytest sau gating fix: 24/24 (vnstock_client + test_refresh + test_seed).
  - Full pytest sau bulk_upsert fix: 256/256.
  - Full pytest sau idna upgrade: 256/256.
  - Ruff pass trên các file đã chạm.
- Real-data verification chu kỳ:
  - Run 1 sau per-call gating: 25/26 BCTC success (TIG fail do bulk_upsert bug).
  - Run 2 sau bulk_upsert fix: **26/26 BCTC success** → `vnstock_financial=FRESH` 🎯.
  - Screening sau full FRESH: scored_count=17 (lên từ 14 Phase 17, 11 Phase 16). 11 GIU + 6 BAN, 0 MUA.
- Server stop sạch sau verify.

## 2. File đã sửa

- `mvp/code/app/crawlers/vnstock_client.py` — per-sub-call gating trong `_fetch_financials_source()`.
- `mvp/code/app/repositories/financial_repo.py` — `bulk_upsert()` normalize rows về consistent key set.
- `mvp/code/uv.lock` — idna 3.13 → 3.15.

## 3. File đã thêm

- `mvp/code/env.production.example` — template prod env.
- `script/backup-db.sh` — SQLite hot backup.
- `script/restore-db.sh` — DB restore với guard.
- `script/cron-refresh.sh` — cron-able /refresh/all trigger.
- `mvp/phases/phase-18-mvp-release-hardening/SUMMARY.md` — audit trail.
- `report/phase-mvp/phase-18-mvp-release-hardening/SUMMARY.md` — file này.

## 4. Lệnh đã chạy

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Tests
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_refresh.py -q
uv run pytest -q                              # 256/256

# Security
uv pip install pip-audit --quiet
uv run pip-audit --strict                     # before idna fix: 1 vuln
uv lock --upgrade-package idna
uv sync --frozen
uv run pip-audit --strict                     # 0 vulns
cd ../../frontend && npm audit --production
cd -

# Real refresh
uv run uvicorn app.main:app --port 8000       # background
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
curl -X POST http://localhost:8000/api/refresh/all -H "Authorization: Bearer $TOKEN"

# Backup smoke
DB_PATH=./data/prod-screener.db BACKUP_DIR=/tmp/screener-backups \
  /Users/ngominhtu/Projects/stock-v2/script/backup-db.sh

# PDF check
curl -o /tmp/test-weasy.pdf \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/export/pdf/$RUN_ID
file /tmp/test-weasy.pdf

# Telegram contract
curl -X POST http://localhost:8000/api/telegram/test \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'

# Screening sau FRESH
curl -X POST http://localhost:8000/api/run \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
# Dashboard cho scored_count
```

## 5. Kết quả

- **`vnstock_financial=FRESH` đạt thật lần đầu** (lên từ PARTIAL trong Phase 16/17). Mốc 2 thực sự closure 100% (cache rule).
- **Screening scored_count 17** (lên 11 → 14 → 17 qua 3 phase).
- Full backend pytest 256/256 pass, ruff sạch.
- 256/256 stress-tested qua per-call gating + bulk_upsert normalize + idna upgrade.
- BE security: 0 known vulnerabilities (sau idna 3.13 → 3.15).
- Backup script hot-DB-safe, smoke test OK với 1.2MB prod DB.
- Cron + restore scripts syntax clean, ready cho production wire.
- PDF weasyprint mode export thành công 29KB PDF v1.7.
- Telegram endpoint envelope đúng contract Phase 8.

## 6. Tồn đọng

- **Step 8 — Playwright critical-path smoke** (Phase 19): login → refresh → run → dashboard → portfolio → backtest → share → PDF. Cần FE dev server chạy parallel.
- **Telegram real-send live test**: cần user cấp Bot token + chat ID; endpoint contract đã verify.
- **FE security upgrade**: Next 16 / next-intl 4.12 / postcss qua breaking upgrade. Đề xuất Phase 19 chia thành: (a) upgrade isolated branch, (b) FE regression smoke, (c) merge.
- **Production deploy actuals**: Docker build + push registry + provision host + HTTPS reverse proxy + crontab wire. Phase 18 đã chuẩn bị xong tooling, deploy thực tế sang post-MVP.
- **Vnstock paid API key** (Insiders program): nếu mua, có thể giảm `VNSTOCK_RATE_LIMIT_S` xuống <2s, refresh 14 phút → ~3 phút.
- 0 MUA trong screening lần này: chưa rõ là (a) thị trường thực tháng 5/2026 không có MUA, hay (b) scoring threshold quá strict. Là vấn đề scoring logic (Phase 4), không phải data layer.