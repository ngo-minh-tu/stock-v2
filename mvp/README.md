# MVP Backend — VN Real Estate AI Screener

> *Dữ liệu dẫn đường, quyết định thuộc về bạn* — Ngô Minh Tú

FastAPI single-user MVP backend phục vụ frontend Next.js (xem [frontend/](../frontend/)). Stack: **FastAPI + SQLite + SQLAlchemy + Alembic + uv**.

Build sequence: Phase 0-10 đã ship (xem [PLAN.md](PLAN.md) + [phases/](phases/)). Phase 11 README = file này.

---

## 1. Yêu cầu môi trường

| Tool | Version | Cài đặt |
|---|---|---|
| Python | 3.11.x (locked qua [.python-version](code/.python-version)) | `brew install python@3.11` |
| uv | 0.11+ | `brew install uv` |
| Docker (tuỳ chọn) | 24+ | — chỉ khi muốn chạy production-like |

Source code backend nằm ở [mvp/code/](code/). Lệnh dưới chạy từ thư mục đó (`cd mvp/code`).

---

## 2. Setup local (5 phút)

```bash
cd mvp/code

# 2.1 Cài deps (đọc uv.lock — reproducible build)
uv sync

# 2.2 Copy env, sửa JWT_SECRET nếu cần
cp .env.example .env

# 2.3 Tạo schema (16 bảng)
uv run alembic upgrade head

# 2.4 Seed data (idempotent — re-run an toàn)
#  - 81 stocks (26 real VN + 5 anchor mocks + 50 fillers)
#  - 150 news articles (5 sources, 40/35/25 phân bố sentiment)
#  - 1 user (password = INITIAL_USER_PASSWORD)
#  - 1 default settings row
uv run python -m app.db.seed

# 2.5 Chạy server
uv run uvicorn app.main:app --port 8000
# → http://localhost:8000
```

Verify nhanh:
```bash
curl http://localhost:8000/api/health
# {"success":true,"data":{"status":"ok","active_job":null}}
```

---

## 3. Env vars

Đầy đủ trong [.env.example](code/.env.example). Các vars quan trọng:

| Key | Mặc định | Mô tả |
|---|---|---|
| `APP_ENV` | `development` | `development` \| `production` |
| `DB_PATH` | `./data/screener.db` | SQLite file (Docker: `/app/data/screener.db`) |
| `DB_BUSY_TIMEOUT_MS` | `5000` | SQLite busy timeout cho WAL |
| `JWT_SECRET` | (placeholder) | **PHẢI** đổi trong production (≥ 32 chars) |
| `JWT_TTL_HOURS` | `24` | Token sống 1 ngày |
| `INITIAL_USER_PASSWORD` | `ChangeMe123!` | Mật khẩu seed user; đổi ngay sau lần login đầu (PUT /api/auth/password) |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS allow-origin (Next.js dev) |
| `VNSTOCK_RATE_LIMIT_S` | `0.5` | Delay giữa các call vnstock |
| `VNSTOCK_TIMEOUT_S` | `10` | HTTP timeout vnstock |
| `TELEGRAM_BOT_TOKEN` | `` (empty) | Để rỗng → telegram disabled; user tự cấu hình runtime qua /api/settings |
| `TELEGRAM_CHAT_ID` | `` (empty) | Tương tự |
| `EXPORT_PDF_MODE` | `weasyprint` | `weasyprint` (binary PDF) \| `html_mock` (HTML giả-PDF dev fallback) |

---

## 4. Endpoint examples (curl)

Backend serve 39 endpoints theo TAD g02 §1. Quy ước envelope:
- Success: `{"success": true, "data": {...}}`
- Error: `{"success": false, "error": {"code": "ERR-XX-XX", "message": "..."}}`

### 4.1 Login + token

```bash
TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"ChangeMe123!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
echo "JWT=$TOKEN"
```

### 4.2 Đổi mật khẩu (rotate token)

```bash
curl -sS -X PUT http://localhost:8000/api/auth/password \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"current":"ChangeMe123!","new_password":"NewSecret!2026"}'
# → {"success":true,"data":{"token":"...new JWT..."}}
```

> ⚠️ Field name là `current` (không phải `current_password`) — match Pydantic schema. Phase 10 đã reconcile FE/BE.

### 4.3 Chạy screening run end-to-end

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

### 4.4 Portfolio CRUD

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

### 4.5 Share link + PDF export

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

## 5. Test

```bash
cd mvp/code

# Toàn bộ suite (232 tests, ~8 phút lần đầu — sau cached lại nhanh)
uv run pytest -q

# Theo nhóm
uv run pytest tests/unit -q              # 82 unit tests
uv run pytest tests/integration -q       # 150 integration tests

# Theo file
uv run pytest tests/integration/test_run_lifecycle.py -v
```

Sau khi sửa code, lint:
```bash
uv run ruff check app/ tests/
uv run ruff format --check app/ tests/
```

---

## 6. Docker (production-like)

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

## 7. Troubleshooting

### "database is locked" / SQLite contention
WAL mode + busy_timeout 5s đã enable mặc định ([db/pragmas.py](code/app/db/pragmas.py)). Nếu vẫn lock:
- Đảm bảo không có process khác đang giữ DB (đặc biệt sau Ctrl+C giữa pytest)
- Tăng `DB_BUSY_TIMEOUT_MS=15000` trong `.env`
- Xoá `.db-wal` + `.db-shm` nếu file orphan

### Pytest fail với `UNIQUE constraint failed: financial_reports.ticker, financial_reports.period`
Fixture `screening_data` cleanup không chạy khi pytest abort (Ctrl+C). Stale rows persist → bulk_insert UNIQUE conflict. Reset:

```bash
cd mvp/code
uv run python -c "
from app.db.session import SessionLocal
from app.models.financial import FinancialReport
from app.models.stock import StockPrice
from app.models.run import ScreeningResult, ExcludedStock, ScreeningRun
from app.models.share import ShareLink
from app.models.backtest import BacktestRun, BacktestResult
from app.models.portfolio import PortfolioHolding
from sqlalchemy import delete
with SessionLocal() as db:
    db.execute(delete(ShareLink))
    db.execute(delete(BacktestResult)); db.execute(delete(BacktestRun))
    db.execute(delete(ScreeningResult)); db.execute(delete(ExcludedStock)); db.execute(delete(ScreeningRun))
    db.execute(delete(PortfolioHolding))
    db.execute(delete(FinancialReport)); db.execute(delete(StockPrice))
    db.commit()
"
```

### vnstock fetch fail / rate limit
- vnstock library rate-limit 0.5s mặc định ([crawlers/vnstock_client.py](code/app/crawlers/vnstock_client.py))
- Khi vnstock 503 → cache_manager fallback dùng dữ liệu cũ + emit warning badge `STALE_DATA` ([crawlers/cache_manager.py](code/app/crawlers/cache_manager.py))
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

## 8. Layout backend

```
mvp/
├── PLAN.md              # 11-phase build plan (Phase 0-10 done)
├── README.md            # ← file này
├── phases/              # SUMMARY.md mỗi phase (audit trail)
│   ├── phase-0-bootstrap/
│   ├── phase-1-db-constants-seed/
│   ├── ...
│   └── phase-10-integration-qa/
└── code/                # Source backend
    ├── app/
    │   ├── api/         # 15 router files
    │   ├── services/    # business logic
    │   ├── engines/     # ML stubs + baseline scoring
    │   ├── crawlers/    # vnstock + cache_manager + news fixture
    │   ├── models/      # SQLAlchemy ORM (16 tables)
    │   ├── schemas/     # Pydantic v2 request/response
    │   ├── repositories/ # data access
    │   ├── constants/   # enums, thresholds, reason codes
    │   ├── core/        # envelope, errors, jwt, password
    │   └── db/          # session, pragmas, seed
    ├── alembic/         # migration 0001_initial_schema
    ├── tests/           # 232 tests (unit + integration)
    ├── Dockerfile       # multi-stage uv
    ├── entrypoint.sh    # alembic upgrade + uvicorn
    ├── pyproject.toml   # uv deps
    └── uv.lock          # locked deps
```

---

## 9. Giới hạn MVP (intentional defers)

Theo [PLAN.md §6](PLAN.md):

- ❌ **XGBoost / LSTM** chưa train — backend chỉ baseline (weighted-sum + naive trend). ABC interface ([engines/base.py](code/app/engines/base.py)) sẵn sàng cho swap.
- ❌ **News RSS crawler thực** — backend serve 150 articles fixture (port từ FE mocks). News page hoạt động bình thường, chỉ là data tĩnh.
- ❌ **Macro crawler thực** (SBV/GSO) — hardcoded constants trong [crawlers/macro_crawler.py](code/app/crawlers/macro_crawler.py).
- ❌ **Backtest strict per PRD §4.5** — hiện mock heuristic dựa trên screening output (đủ cho UI demo).
- ❌ **Multi-user / RBAC** — single-user MVP (1 row trong `user_profiles`).

Roadmap post-MVP: xem [report/mvp-build-summary.md §5](../report/mvp-build-summary.md).

---

*Cập nhật 2026-05-11 (Phase 11) · Build state ledger: [report/mvp-build-summary.md](../report/mvp-build-summary.md)*
