# Phase 18 — MVP Release Hardening (Mốc 3, steps 2-7)

**Status:** COMPLETED 2026-05-20
**Spec ref:** Mốc 3 hand-off từ [Phase 17 §7](../phase-17-financial-source-fallback/SUMMARY.md). TAD [g04-cache.md](../../../docs/tad/g04-cache.md) + [g05-jobs.md](../../../docs/tad/g05-jobs.md) + [g07-deployment.md](../../../docs/tad/g07-deployment.md).

## 1. Scope

Đóng Mốc 3 phần backend hardening + tooling production. Triển khai từng step theo thứ tự ưu tiên Codex.

Trong scope (steps 2-7):

- **Step 2** — Vnstock quota hardening: per-sub-call gating + sửa bulk_upsert bug.
- **Step 3** — Production env config + SQLite backup/restore scripts.
- **Step 4** — Telegram endpoint contract verify (real-send creds là user-side).
- **Step 5** — PDF export check trong browser (weasyprint default).
- **Step 6** — Cron refresh schedule script.
- **Step 7** — Security/dependency audit FE + BE.

Out of scope (carry sang Phase 19):

- **Step 8** — Playwright critical-path smoke (cần setup riêng + FE running).
- FE breaking upgrades (Next 16, next-intl 4.12) — phụ thuộc QA chu kỳ riêng.
- Telegram real-send live test — cần user cấp Bot token + chat ID.

## 2. Pre-code audit / drift

| # | Drift / issue | Resolution |
|---|---|---|
| 1 | `_gate_wait()` chỉ chạy 1 lần/ticker; BCTC = 4 sub-call (income/balance/cash/ratio) burst → vượt vnstock guest quota 20 req/min | ✅ Per-sub-call gating: 4 lần `_gate_wait()` trong `_fetch_financials_source()` |
| 2 | `financial_repo.bulk_upsert()` fail khi rows có heterogeneous keys (TIG 2025Q1 thiếu `total_equity`) | ✅ Normalize mọi row về cùng key set với `None` cho field thiếu |
| 3 | Chỉ có `.env.example` (dev) và `env.demo.example` — không có template prod-grade | ✅ Thêm `env.production.example` với JWT_SECRET CHANGE_ME + comments |
| 4 | Chưa có SQLite backup tooling | ✅ `script/backup-db.sh` dùng SQLite hot `.backup` API (WAL-safe) + integrity check + retention |
| 5 | Chưa có DB restore tooling | ✅ `script/restore-db.sh` với pre-restore snapshot + uvicorn-running guard |
| 6 | TAD g05 §3 quy định refresh schedule 16:30 ICT nhưng chưa wire cron | ✅ `script/cron-refresh.sh` dùng curl login → trigger /refresh/all → poll status |
| 7 | Chưa audit deps cho FE/BE | ✅ pip-audit BE (0 vulns sau idna 3.13→3.15); npm audit FE (1 critical + 2 moderate, document defer breaking upgrade) |

## 3. Deliverables

| Path | Nội dung |
|---|---|
| [app/crawlers/vnstock_client.py](../../code/app/crawlers/vnstock_client.py) | Per-sub-call `_gate_wait()` trong `_fetch_financials_source()`; remove outer gate trong `fetch_financials()` loop |
| [app/repositories/financial_repo.py](../../code/app/repositories/financial_repo.py) | `bulk_upsert()` normalize rows về cùng key set với None defaults |
| [env.production.example](../../code/env.production.example) | Template prod env với JWT_SECRET/INITIAL_USER_PASSWORD placeholder + comments |
| [script/backup-db.sh](../../../script/backup-db.sh) | Hot backup script với integrity check + retention |
| [script/restore-db.sh](../../../script/restore-db.sh) | Restore script với pre-restore snapshot + uvicorn guard |
| [script/cron-refresh.sh](../../../script/cron-refresh.sh) | Cron-able refresh trigger với login → poll → exit code |
| `mvp/code/uv.lock` | idna upgrade 3.13 → 3.15 (CVE-2026-45409 fix) |

## 4. Exit criteria

| Check | Result |
|---|---|
| Per-call gating no test breakage | PASS — 5/5 vnstock_client tests + 19/19 refresh tests |
| Full backend pytest | PASS — 256/256 |
| Ruff | PASS |
| `/refresh/all` real network với gating | PASS — 14 phút, prices 26/26 + financials 26/26 success |
| `vnstock_price=FRESH` | PASS — full universe 100% |
| `vnstock_financial=FRESH` | **PASS** ✅ — đầu tiên đạt FRESH với real data (lên từ PARTIAL trong Phase 16/17) |
| `script/backup-db.sh` smoke | PASS — 1.2MB backup tạo OK, integrity check pass, exit 0 |
| `script/restore-db.sh` syntax | PASS — `bash -n` clean |
| `script/cron-refresh.sh` syntax | PASS — `bash -n` clean |
| PDF export weasyprint mode | PASS — HTTP 200, application/pdf, 29KB, magic `%PDF-1.7` |
| Telegram endpoint envelope | PASS — `{success:true, data:{sent:false, error:"..."}}` khi creds empty |
| BE security audit | PASS — 0 known vulns sau idna upgrade |
| FE security audit | DOCUMENTED — 1 critical (next) + 2 moderate (next-intl, postcss); all fix qua breaking Next 16 upgrade, defer |
| Screening sau full FRESH data | PASS — scored_count=17 (lên từ 11 Phase 16, 14 Phase 17) |

## 5. Locked decisions

| Mục | Giá trị | Lý do |
|---|---|---|
| Vnstock gating granularity | Per-sub-call (4 `_gate_wait()` cho mỗi ticker BCTC) | BCTC = 4 sub-call/ticker; per-ticker gating cũ để burst vượt quota guest 20 req/min |
| Refresh thời gian | ~14 phút cho 26 ticker (price 3min + financial 11min) | Trade-off speed vs quota safety; với paid vnstock API có thể giảm `VNSTOCK_RATE_LIMIT_S` |
| bulk_upsert normalize | Force same key set với None default cho field thiếu | SQLAlchemy `sqlite_insert(...).values([heterogeneous_rows])` không support natively |
| Prod env template | `env.production.example` riêng (không patch `.env.example`) | Tránh nhầm dev với prod values; FE/BE/devops mỗi role có template riêng |
| Backup strategy | SQLite hot `.backup` API (không `cp`) | WAL-safe khi uvicorn đang serve; integrity check sau backup |
| Restore strategy | Refuse khi uvicorn đang chạy + preserve current DB | Tránh accidental data loss; recovery path luôn rollback được |
| Cron script approach | Bash + curl (không Python) | Min runtime deps; chỉ cần sqlite3 + curl + python3 (parse JSON token) đã có sẵn ở mọi Linux server |
| FE security upgrades | DEFER Next 16 / next-intl 4.12 / postcss breaking upgrades | Phase 18 scope: backend hardening + tooling; FE major upgrade cần regression cycle riêng (Phase 19+) |

## 6. Verification commands

```bash
cd /Users/ngominhtu/Projects/stock-v2/mvp/code

# Tests after fixes
uv run pytest tests/unit/test_vnstock_client.py tests/integration/test_refresh.py -q
uv run pytest -q  # 256/256
uv run ruff check app/ tests/

# Security audit
uv pip install pip-audit --quiet
uv run pip-audit --strict     # BE: 0 vulns
cd ../../frontend && npm audit --production  # FE: 3 vulns (defer)
cd -

# Backup smoke
DB_PATH=./data/prod-screener.db BACKUP_DIR=/tmp/screener-backups \
  ../../script/backup-db.sh

# Real network refresh + screening
uv run uvicorn app.main:app --port 8000   # background
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
curl -X POST http://localhost:8000/api/refresh/all -H "Authorization: Bearer $TOKEN"
# Poll status ~14 min
curl -X POST http://localhost:8000/api/run -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# Get scored_count from /dashboard

# PDF check
curl -o test.pdf -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/export/pdf/$RUN_ID
file test.pdf  # → PDF document, version 1.7
```

## 7. Hand-off cho Phase 19

Phase 18 đóng 6/7 step Mốc 3. Phase 19 / post-MVP cần:

1. **Step 8 — Playwright critical-path smoke** (chưa làm): login → refresh/run → dashboard → portfolio → backtest → share → PDF. Cần FE dev server chạy parallel. Đề xuất chia thành: install playwright + 1 smoke test/critical path = 8 tests.
2. **Telegram real-send live test** — cần user cấp Bot token + chat ID, set vào settings hoặc env. Endpoint contract đã verify ở Phase 18.
3. **FE security upgrade**:
   - `next` < 16.3.0-canary.5 (CRITICAL) → fix via Next 16.2.6 (breaking).
   - `next-intl` <= 4.9.1 (MODERATE: open redirect + prototype pollution) → fix via 4.12.0 (breaking).
   - `postcss` < 8.5.10 (MODERATE: XSS) → fix qua Next upgrade.
4. **Production deploy**:
   - Build Docker image, push registry.
   - Provision host (VPS hoặc cloud).
   - Volume mount `data/screener.db` + `.env` (từ `env.production.example`).
   - HTTPS reverse proxy (Caddy/nginx) trước FE + BE.
   - Crontab: `30 9 * * 1-5 /srv/stock-screener/script/cron-refresh.sh` + `0 3 * * * /srv/stock-screener/script/backup-db.sh`.