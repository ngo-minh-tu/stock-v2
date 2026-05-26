# MVP Backend — VN Real Estate AI Screener

> *Dữ liệu dẫn đường, quyết định thuộc về bạn* — Ngô Minh Tú

FastAPI single-user MVP backend phục vụ frontend Next.js (xem [frontend/](../frontend/)). Stack: **FastAPI + SQLite + SQLAlchemy + Alembic + uv**.

Build sequence: **Phase 0-28 đã ship — Mốc 1+2+3+4 + Track 1+2+3+4+5+6 đóng** (xem [plan/PLAN.md](../plan/PLAN.md) + [phases/](phases/)). Phase 13 tách DB test/demo; Phase 14-16 đóng Mốc 2; Phase 17-18 đóng Mốc 3 steps 1-7; Phase 19 đóng Mốc 3 step 8 (Playwright 8/8); Phase 20 đóng Mốc 3 step 9 (Telegram real-send); Phase 21-22 đóng Mốc 4; Phase 23 đóng Track 2 Telegram; Phase 24 đóng Track 1 Security (FE Next 16); Phase 25 đóng Track 5 Pre-Handoff UX; Phase 26 đóng Track 3 Data Quality; Phase 27 đóng Track 4 Deploy baseline + extras; Phase 28 đóng Track 6 Polish batch (InfoBanner dismiss + LocalStorage persist + Telegram 429 retry + sanity guards consolidate + `_PRODUCTION_FORBIDDEN_FILES` extensible + period suffix log DEBUG + `test_compare` floating-point flake fix). Post-Phase closure 2026-05-24 đóng thêm 3 deferred items: macro crawler real-source best-effort, backtest strict PRD §4.5, Turbopack migration. **BE 311/311 tests baseline · latest targeted deferral regression 55/55 pass · FE Playwright 8/8 trên Next 16.**

---

## 1. Yêu cầu môi trường

| Tool | Version | Cài đặt |
|---|---|---|
| Python | 3.11.x (locked qua [.python-version](code/.python-version)) | `brew install python@3.11` |
| uv | 0.11+ | `brew install uv` |
| Docker (tuỳ chọn) | 24+ | — chỉ khi muốn chạy production-like |

Source code backend nằm ở [mvp/code/](code/). Lệnh dưới chạy từ thư mục đó (`cd mvp/code`).

---

## 2. Setup local demo ổn định (5 phút)

```bash
cd mvp/code

# 2.1 Cài deps (đọc uv.lock — reproducible build)
uv sync

# 2.2 Dùng DB demo riêng, không dùng chung với pytest
cp env.demo.example .env

# 2.3 Seed demo data (idempotent theo nghĩa reset demo DB về trạng thái ổn định)
#  - 81 stocks (26 real VN + 5 anchor mocks + 50 fillers)
#  - synthetic prices + financial_reports đủ để screening có kết quả
#  - 150 news articles (5 sources, 40/35/25 phân bố sentiment)
#  - 1 user (password = INITIAL_USER_PASSWORD)
#  - 1 default settings row
#  - 1 completed demo run: run_demo_latest
uv run python -m app.db.demo_seed

# 2.4 Chạy server
uv run uvicorn app.main:app --port 8000
# → http://localhost:8000
```

Verify nhanh:
```bash
curl http://localhost:8000/api/health
# {"success":true,"data":{"status":"ok","active_job":null}}
```

---

## 3. DB modes (4 modes locked Phase 16)

| Mode | DB path | Lệnh chính | Mục đích |
|---|---|---|---|
| Dev | `./data/screener.db` | `.env.example` + `alembic upgrade head` + `seed.py` | Phát triển local, có thể mix dữ liệu |
| Test | `./data/test-screener.db` | `uv run pytest -q` | Pytest tự cấu hình DB riêng, không chạm demo/prod (Phase 13) |
| Demo local | `./data/demo-screener.db` | `cp env.demo.example .env && uv run python -m app.db.demo_seed` | UI có sẵn `run_demo_latest` synthetic |
| Production-like | `./data/prod-screener.db` | `cp env.production.example .env` + `alembic upgrade head` + `seed.py` + `/api/refresh/all` | Real vnstock data, 26 real RE ticker, cache FRESH (Phase 16-18) |

`tests/conftest.py` có guard fail sớm nếu pytest trỏ nhầm vào DB không có chữ `test` trong filename.
`app.db.demo_seed` từ chối chạy nếu `DB_PATH` không có chữ `demo`.
Refresh universe (Phase 16): `stock_repo.list_active_tickers()` lọc `WHERE status='ACTIVE' AND ticker NOT LIKE 'MOCK%'` → 26 real ticker (55 MOCK seed giữ lại cho test/dev/FE prototype).

## 4. Env vars

Đầy đủ trong [.env.example](code/.env.example) (dev), [env.demo.example](code/env.demo.example) (Phase 13) và [env.production.example](code/env.production.example) (Phase 18 — prod-grade với JWT_SECRET placeholder + comments). Các vars quan trọng:

| Key | Mặc định | Mô tả |
|---|---|---|
| `APP_ENV` | `development` | `development` \| `production` |
| `DB_PATH` | `./data/screener.db` | SQLite file (Docker: `/app/data/screener.db`) |
| `DB_BUSY_TIMEOUT_MS` | `5000` | SQLite busy timeout cho WAL |
| `JWT_SECRET` | (placeholder) | **PHẢI** đổi trong production (≥ 32 chars) |
| `JWT_TTL_HOURS` | `24` | Token sống 1 ngày |
| `INITIAL_USER_PASSWORD` | `ChangeMe123!` | Mật khẩu seed user; đổi ngay sau lần login đầu (PUT /api/auth/password) |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS allow-origin (Next.js dev) |
| `VNSTOCK_RATE_LIMIT_S` | `6.5` | Delay giữa các vnstock sub-call. Phase 18 chuyển sang **per-sub-call gating** trong `fetch_financials()` (BCTC = 4 sub-call/ticker), tránh burst vượt quota guest 20 req/phút. Full `/refresh/all` 26 ticker ≈ 14 phút |
| `VNSTOCK_TIMEOUT_S` | `10` | HTTP timeout vnstock |
| `TELEGRAM_BOT_TOKEN` | `` (empty) | Để rỗng → telegram disabled; user tự cấu hình runtime qua /api/settings. **Phase 20:** local dev có thể tạo riêng `mvp/code/.env.telegram` (gitignored qua `.env.*` pattern); pydantic-settings chain-load qua `env_file=(".env", ".env.telegram")` |
| `TELEGRAM_CHAT_ID` | `` (empty) | Tương tự. Lấy chat_id: user `/start` bot → curl `https://api.telegram.org/bot<TOKEN>/getUpdates` → parse `result[0].message.chat.id` |
| `EXPORT_PDF_MODE` | `weasyprint` | `weasyprint` (binary PDF) \| `html_mock` (HTML giả-PDF dev fallback) |

---

## 5. Endpoint examples (curl)

Backend serve 39 endpoints theo TAD g02 §1. Quy ước envelope:
- Success: `{"success": true, "data": {...}}`
- Error: `{"success": false, "error": {"code": "ERR-XX-XX", "message": "..."}}`

### 5.1 Login + token

```bash
TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
echo "JWT=$TOKEN"
```

### 5.2 Đổi mật khẩu (rotate token)

```bash
curl -sS -X PUT http://localhost:8000/api/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"current":"ChangeMe123!","new_password":"NewSecret!2026"}'
# → {"success":true,"data":{"token":"...new JWT..."}}
```

> ⚠️ Field name là `current` (không phải `current_password`) — match Pydantic schema. Phase 10 đã reconcile FE/BE.

### 5.3 Chạy screening run end-to-end

```bash
# Bắt đầu run async (202 PENDING)
RUN_ID=$(curl -sS -X POST http://localhost:8000/api/run \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"total_capital": 500000000}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['run_id'])")

# Poll status (PENDING → CHECKING_DATA → … → COMPLETED, mất ~1-3s)
curl -sS "http://localhost:8000/api/runs/$RUN_ID/status" \
  -H "Authorization: Bearer $TOKEN"

# Dashboard aggregate
curl -sS "http://localhost:8000/api/runs/$RUN_ID/dashboard" \
  -H "Authorization: Bearer $TOKEN"

# Bảng kết quả + stock detail
curl -sS "http://localhost:8000/api/runs/$RUN_ID/results" -H "Authorization: Bearer $TOKEN"
curl -sS "http://localhost:8000/api/runs/$RUN_ID/stocks/VHM" -H "Authorization: Bearer $TOKEN"

# Lý do bị loại
curl -sS "http://localhost:8000/api/runs/$RUN_ID/excluded" -H "Authorization: Bearer $TOKEN"
```

### 5.4 Portfolio CRUD

```bash
# Tạo (ticker tự uppercase, phải nằm trong whitelist 81 mã)
curl -sS -X POST http://localhost:8000/api/portfolio \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ticker":"vhm","quantity":1000,"buy_price":40.0,"buy_date":"2026-05-01","notes":"test"}'

# Liệt kê
curl -sS http://localhost:8000/api/portfolio -H "Authorization: Bearer $TOKEN"

# Xoá (200 + body envelope, KHÔNG 204)
curl -sS -X DELETE http://localhost:8000/api/portfolio/1 -H "Authorization: Bearer $TOKEN"
# → {"success":true,"data":{"id":1,"deleted":true}}
```

### 5.5 Share link + PDF export

```bash
# Tạo share token (7-day TTL)
TOKEN_SHARE=$(curl -sS -X POST http://localhost:8000/api/share \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"run_id\":\"$RUN_ID\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# Public view (KHÔNG cần auth)
curl -sS "http://localhost:8000/api/share/$TOKEN_SHARE"

# Tải PDF binary
curl -sS -o report.pdf "http://localhost:8000/api/export/pdf/$RUN_ID" -H "Authorization: Bearer $TOKEN"
file report.pdf   # → PDF document, version 1.7
```

---

## 6. Test

```bash
cd mvp/code

# Toàn bộ suite (311 tests baseline post-Phase 28, ~8 phút lần đầu — sau cached lại nhanh).
# Suite tự dùng ./data/test-screener.db và không xoá dữ liệu demo.
uv run pytest -q

# Theo nhóm
uv run pytest tests/unit -q              # ~145 unit tests
uv run pytest tests/integration -q       # ~166 integration tests

# Theo file
uv run pytest tests/integration/test_run_lifecycle.py -v
```

Sau khi sửa code, lint:
```bash
uv run ruff check app/ tests/
uv run ruff format --check app/ tests/
```

---

## 7. Docker (production-like)

```bash
cd mvp/code
docker build -t vn-re-screener .
docker run -p 8000:8000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  vn-re-screener
```

Image multi-stage (builder + runtime), runtime layer cài WeasyPrint deps (libpango + Noto fonts cho tiếng Việt). Entrypoint tự chạy `alembic upgrade head` trước khi `uvicorn`.

Healthcheck endpoint built-in: `GET /api/health` (Docker auto-check mỗi 30s).

---

## 8. Troubleshooting

### "database is locked" / SQLite contention
WAL mode + busy_timeout 5s đã enable mặc định ([db/pragmas.py](code/app/db/pragmas.py)). Nếu vẫn lock:
- Đảm bảo không có process khác đang giữ DB (đặc biệt sau Ctrl+C giữa pytest)
- Tăng `DB_BUSY_TIMEOUT_MS=15000` trong `.env`
- Xoá `.db-wal` + `.db-shm` nếu file orphan

### Pytest fail với `UNIQUE constraint failed: financial_reports.ticker, financial_reports.period`
Phase 13 đã chuyển pytest sang `./data/test-screener.db` và xoá DB test khi session bắt đầu. Nếu vẫn gặp lỗi, xoá test DB rồi chạy lại:

```bash
cd mvp/code
rm -f data/test-screener.db data/test-screener.db-wal data/test-screener.db-shm
uv run pytest -q
```

### Demo DB trống sau khi test
Không còn là behavior mong muốn. Pytest không được chạm `demo-screener.db`. Nếu cần khôi phục demo:

```bash
cd mvp/code
cp env.demo.example .env
uv run python -m app.db.demo_seed
```

### vnstock fetch fail / rate limit
- vnstock library rate-limit 6.5s/sub-call mặc định ([crawlers/vnstock_client.py](code/app/crawlers/vnstock_client.py)). Phase 18 chuyển sang **per-sub-call gating** (BCTC = 4 sub-call/ticker income/balance/cash/ratio), tránh burst vượt quota.
- Phase 12 smoke ghi nhận guest quota 20 requests/phút; nếu mua vnstock paid API key (Insiders) có thể giảm rate-limit xuống <2s và refresh 14m → ~3m.
- Phase 14 đổi price client sang `vnstock.api.quote.Quote`; refresh status trả thêm `stats`.
- Phase 16 fix unit mismatch: vnstock VCI trả OHLC trong **ngàn đồng**, scale ×1000 ở ingest boundary qua `_scale_vnd()`. DB store luôn raw VND (align `demo_seed.base_close=25_000` + `filter_service.PRICE_FLOOR=15_000`).
- Phase 17 add fallback chain `("VCI", "KBS")` trong `fetch_financials()` — `Finance(source=...)` chỉ accept 2 source này (TCBS/MSN ValueError). Khi VCI exception/empty → tự thử KBS.
- Phase 18 fix `financial_repo.bulk_upsert()` để xử lý rows có heterogeneous key set (e.g. TIG 2025Q1 missing `total_equity`) — normalize về cùng key set với `None` defaults.
- Khi refresh một phần lỗi: các ticker thành công được commit trước, ticker lỗi/rỗng được ghi trong `stats.failed_tickers` / `stats.empty_tickers`.
- Cache là source-level theo TAD g04: chỉ full refresh universe thành công 100% mới mark `vnstock_price=FRESH` / `vnstock_financial=FRESH`; partial/subset/resume có rows thành công mark `PARTIAL`.
- Prod-screener.db (Phase 16+) đã đạt cả 2 cache FRESH với 26 real RE ticker (refresh 14 phút, scored=17).
- Resume lượt lỗi/rỗng gần nhất:

```bash
curl -sS -X POST http://localhost:8000/api/refresh/prices \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"resume_failed":true}'
```

- Refresh subset ticker:

```bash
curl -sS -X POST http://localhost:8000/api/refresh/prices \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"tickers":["VHM","VIC"]}'
```

- Khi vnstock 503 → refresh job ghi ticker lỗi vào stats; screening downstream vẫn dùng cache usability gate ([crawlers/cache_manager.py](code/app/crawlers/cache_manager.py))
- Test mode dùng synthetic data, không gọi vnstock thật

### Telegram /test trả `sent:false, error:"Telegram chưa cấu hình..."`
Đúng behavior khi `telegram_chat_id` hoặc `telegram_token` trong settings rỗng. Vào UI Settings → mục Telegram để điền + Save, rồi test lại.

### Port 8000 đã bị chiếm
```bash
uv run uvicorn app.main:app --port 8001
# Nhớ update FRONTEND_ORIGIN tương ứng nếu FE đổi port
```

### Đổi password rồi mất token
Response của `PUT /api/auth/password` trả token mới — lưu ngay vào localStorage hoặc Authorization header tiếp theo. Nếu lỡ mất, login lại với password mới qua `POST /api/auth/login`.

---

## 9. Layout backend

```
mvp/
├── README.md            # ← file này (plan/PLAN.md ở repo root từ commit 7a107e6)
├── phases/              # SUMMARY.md + REVIEW.md mỗi phase (audit trail engineering)
│   ├── phase-0-bootstrap/  ...  phase-11-readme/
│   ├── phase-12-production-data-qa/             # post-MVP QA (Codex audit)
│   ├── phase-13-demo-stability/                 # Mốc 1: demo + DB isolation
│   ├── phase-14-production-data-hardening/      # Mốc 2: prices code
│   ├── phase-15-financial-ingestion/            # Mốc 2: BCTC code
│   ├── phase-16-mvp-data-readiness-closure/     # Mốc 2: closure thật (FRESH + scored>0)
│   ├── phase-17-financial-source-fallback/      # Mốc 3 step 1 (VCI→KBS fallback)
│   ├── phase-18-mvp-release-hardening/          # Mốc 3 steps 2-7 (gating + prod env + scripts + security)
│   ├── phase-19-playwright-smoke/               # Mốc 3 step 8 (E2E 8/8 + 4 production bug fix)
│   ├── phase-20-telegram-real-send-verify/      # Mốc 3 step 9 (Telegram bot + gitignored secrets)
│   ├── phase-21-financial-quality-no-downgrade/ # Mốc 4 step 1 (parser KBS + COALESCE upsert + multi-source merge)
│   ├── phase-22-financial-unit-scaling/         # Mốc 4 step 2 (VCI raw / KBS ×1000 + prod secret guard)
│   ├── phase-23-telegram-broadcast-config-env/  # Track 2 (broadcast wired vào screening finalize + config_env_chain pytest)
│   ├── phase-24-fe-next16-security-upgrade/     # Track 1 (FE Next 16 + next-intl 4 + ngrok blocker cleared)
│   ├── phase-25-pre-handoff-ux-polish/          # Track 5 (schema rename + 3 disclaimer + TODAY runtime + sanity guard + refresh script)
│   ├── phase-26-kbs-data-polish/                # Track 3 (bvps fallback + period suffix lock + KBS snapshot regression)
│   ├── phase-27-deploy-polish/                  # Track 4 (useExportPdf binary-safe + PriceBoard placeholder + equity sanity + docker-compose/nginx template)
│   └── phase-28-polish-batch/                   # Track 6 (dismiss banner + 429 retry + sanity consolidate + prod guard ext + log tuning + test flake)
└── code/                # Source backend
    ├── app/
    │   ├── api/         # 13 router files
    │   ├── services/    # business logic
    │   ├── engines/     # ML stubs + baseline scoring
    │   ├── crawlers/    # vnstock + cache_manager + news fixture
    │   ├── models/      # SQLAlchemy ORM (16 tables)
    │   ├── schemas/     # Pydantic v2 request/response
    │   ├── repositories/ # data access
    │   ├── constants/   # enums, thresholds, reason codes
    │   ├── core/        # envelope, errors, jwt, password
    │   └── db/          # session, pragmas, seed, demo_seed
    ├── alembic/         # migration 0001_initial_schema
    ├── tests/           # 311 tests (unit + integration, isolated test DB)
    ├── Dockerfile       # multi-stage uv
    ├── entrypoint.sh    # alembic upgrade + uvicorn
    ├── pyproject.toml   # uv deps
    ├── uv.lock          # locked deps (idna 3.15 sau Phase 18 CVE fix)
    ├── .env.example     # dev defaults
    ├── env.demo.example # demo DB (Phase 13)
    └── env.production.example  # prod template với CHANGE_ME placeholders (Phase 18)
```

### Production tooling scripts ([script/](../script/), Phase 18)

| Script | Mục đích |
|---|---|
| `script/backup-db.sh` | SQLite hot `.backup` API (WAL-safe khi uvicorn đang serve) + integrity check + retention N ngày |
| `script/restore-db.sh <backup-file> [target]` | Restore với pre-restore snapshot + refuse khi uvicorn running |
| `script/cron-refresh.sh` | Cron-able `/refresh/all` trigger (env: `API_BASE`, `API_PASSWORD`, optional `LOG_FILE`); recommended `30 9 * * 1-5` = 16:30 ICT weekday (TAD g05 §3) |

Recommended crontab production:
```cron
0 3 * * *    /srv/stock-screener/script/backup-db.sh
30 9 * * 1-5 /srv/stock-screener/script/cron-refresh.sh
```

---

## 10. Giới hạn MVP (intentional defers)

Theo [plan/PLAN.md](../plan/PLAN.md):

- ❌ **XGBoost / LSTM** chưa train — backend chỉ baseline (weighted-sum + naive trend). ABC interface ([engines/base.py](code/app/engines/base.py)) sẵn sàng cho swap.
- ✅ **News RSS crawler thực** — [news_rss.py](code/app/crawlers/news_rss.py) + [news_crawl_service.py](code/app/services/news_crawl_service.py) crawl nguồn RSS/news real-source; fixture/seed vẫn dùng cho demo hoặc fallback.
- ✅ **Macro crawler thực** — [crawlers/macro_crawler.py](code/app/crawlers/macro_crawler.py) gom World Bank indicators + VN-Index qua vnstock best-effort; [db/seed.py](code/app/db/seed.py) giữ seed M01-M05 làm fallback baseline.
- ✅ **Prices vnstock thực** — Phase 14 + Phase 16 hoàn tất; `vnstock_price=FRESH` trên prod DB với 26 real RE ticker.
- ✅ **BCTC vnstock thực** — Phase 15 thay stub; Phase 17 add VCI→KBS fallback; Phase 18 fix bulk_upsert + per-call gating → `vnstock_financial=FRESH` đạt thật (26/26 ticker).
- ✅ **Backtest strict per PRD §4.5** — [backtest_service.py](code/app/services/backtest_service.py) so recommendation với VN-Index benchmark: MUA phải dương và outperform, BÁN âm hoặc underperform > threshold, GIỮ trong band.
- ❌ **Multi-user / RBAC** — single-user MVP (1 row trong `user_profiles`).
- ✅ **Playwright critical-path smoke** — Mốc 3 step 8 đóng Phase 19; 8/8 pass; lộ + fix 4 production bug (dashboard schema drift, modal a11y, JSON i18n conflict, useExportPdf base URL).
- ✅ **Telegram real-send** — Mốc 3 step 9 đóng Phase 20; bot token + chat_id lưu local trong `code/.env.telegram` (gitignored); pydantic-settings chain-load. Phase 22 add production secret guard fail-fast.
- ✅ **Telegram broadcast khi run COMPLETED** — Phase 23 wired `broadcast_run_summary` vào `screening_service` finalize hook (TAD c07 §1 + SRS f14 UC-14-01..04); AC-14-01 (skip enabled=false), AC-14-02 (sent=true persist), AC-14-03 (failure → TELEGRAM_FAILED warning + COMPLETED_WITH_WARNINGS), AC-14-04 (top_n 3/5).
- ✅ **Financial data quality** — Phase 21 đóng parser KBS + COALESCE no-downgrade upsert + multi-source merge; Phase 22 đóng source-aware unit scaling (VCI raw / KBS ×1000) — real NLG khớp CafeF.
- ✅ **FE security upgrades + Turbopack** — Phase 24 đóng Next 14.2.15 → **16.2.6** + next-intl 4.12.0 + eslint 9 + eslint-config-next 16; post-Phase closure bỏ `--webpack`, `npm run build` chạy Next 16 Turbopack default và prerender 14 routes pass. **Ngrok hand-off blocker cleared.**
- ⏭ **Production deploy actuals** — Docker + reverse proxy + crontab wire. Carry sang Phase 27.
- ✅ **UX polish + pre-handoff** — Phase 25 đóng: schema rename `latest_price`→`latest` triệt để + HoldingFormModal TODAY runtime + 3 banner disclaimer (Dashboard/News/Backtest) + `script/pre-handoff-refresh.sh` operator manual + `feature_service` total_assets sanity guard. Operator chạy refresh script (~22 phút) trước ngrok hand-off.

Roadmap post-MVP: xem [report/mvp-build/SUMMARY.md §5](../report/mvp-build/SUMMARY.md).

---

*Cập nhật 2026-05-24 (Phase 28 đóng + post-Phase deferral closure: macro crawler real-source best-effort, backtest strict PRD §4.5, Turbopack migration; latest targeted backend regression 55/55 pass; FE Next 16.2.6 Turbopack build 14 routes pass) · Build state ledger: [report/mvp-build/SUMMARY.md](../report/mvp-build/SUMMARY.md) · Next-steps roadmap: [plan/PLAN.md §7](../plan/PLAN.md)*
