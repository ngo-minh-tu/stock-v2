# MVP Build Plan — VN RE AI Screener

**Author:** Ngô Minh Tú · **Drafted:** 2026-05-10
**Spec base:** PRD v0.5A · SRS v1.4 · TAD v1.5 (post-prototype reconciliation 6/6)
**Folder code backend:** `mvp/code/` (cạnh `mvp/phases/`). Plan file đã move sang `plan/PLAN.md`. Layout: `plan/PLAN.md` + `mvp/{phases/, code/}` — `code/` chứa toàn bộ Python source + Dockerfile + tests + lockfile; `phases/` chứa summary mỗi phase.

> Quy tắc: **Build code MVP trước, README.md viết SAU CÙNG** (Phase 11). README chỉ chốt lại sau khi toàn bộ stack chạy được — tránh maintenance drift trong lúc build.
>
> **Phase summary convention:** mỗi phase đóng phải có `mvp/phases/phase-{N}-{slug}/SUMMARY.md` (mirror memory rule "every cluster phải có cluster-summary.md before being done"). Source code KHÔNG move vào folder phase — vẫn ở `mvp/app/`, `mvp/alembic/`, `mvp/tests/`. Mọi user-requested fix sau khi phase đóng append vào §8 "Post-phase fixes" của summary tương ứng.

---

## 0. Scope & Decisions

| Mục | Quyết định | Nguồn |
|---|---|---|
| Phạm vi | **Backend Package 0–7** (mới, code trong `mvp/`) + **FE integration Package 8–10** (swap MSW → real API trong `frontend/`) | TAD g08 v1.2 "Frontend Prototype Precedes Packages" |
| Engines | **Baseline only** (scoring weighted-normalize + price naive trend + entry deterministic). XGBoost/LSTM = stub interface có `load()` + `predict()` raise `NotImplemented`, hoán đổi sau khi train | PRD §4.3-4.5 "baseline first" |
| Externals trong MVP | **vnstock real** (Package 4) · **PDF WeasyPrint** (Package 9) · **Telegram bot real** (Package 9) | User chọn 2026-05-10 |
| News RSS | **Defer** — backend serve fixture 150-article corpus (port từ `frontend/src/mocks/data/news.ts`). Frontend News page không phân biệt mock/real. RSS crawler real nâng cấp post-MVP. | User chọn skip |
| Macro | Hardcode constants (Package 4 stub) — production crawler post-MVP |
| Frontend scope | KHÔNG rebuild. Adapt `frontend/` (forked 2026-05-09) — replace MSW handlers bằng `apiFetch` thực, gate MSW qua env var | TAD g08 v1.2 |
| Repo layout | Monorepo single git repo: `mvp/` (backend) + `frontend/` + `prototype/` (frozen) + `docs/` + `data/` + `report/` | TAD §3 (rename `backend/` → `mvp/`) |
| README.md | **Build cuối cùng** sau khi tất cả phase pass — Phase 11 |
| Python deps manager | **uv** (pin Docker image `ghcr.io/astral-sh/uv:0.11`) — `uv init` + `uv add` + `uv run`; lockfile `uv.lock` commit vào git. Local cài qua Homebrew (uv 0.11.12 verified) | User chốt 2026-05-10 |
| Test framework | **pytest thuần** — không thêm pytest-asyncio/httpx-async client trừ khi 1 test thực sự cần (test_run_lifecycle dùng `TestClient` sync của FastAPI là đủ) | User chốt 2026-05-10 |
| CORS origin | `http://localhost:3000` (Next.js default) — config qua env `FRONTEND_ORIGIN` để override khi prod | User chốt 2026-05-10 |
| SQLite path | `/app/data/screener.db` trong container; volume mount `/app/data` để persist; local dev dùng `mvp/data/screener.db` (gitignored) | User chốt 2026-05-10 |
| Migration on boot | Container entrypoint chạy `alembic upgrade head` rồi mới `uvicorn` — MVP single-instance đơn giản, prod sẽ tách step riêng | User chốt 2026-05-10 |

---

## 1. Backend folder/file structure (`mvp/`)

> Tuân thủ TAD §3 layered pattern: **API Router → Service → Repository → SQLAlchemy → SQLite**. Không SQL trực tiếp trong service. Không business logic trong repository.
>
> Tất cả path dưới đây nằm trong `mvp/code/`. Lệnh chạy: `cd mvp/code && uv sync`, `cd mvp/code && uv run pytest`, `cd mvp/code && uv run uvicorn app.main:app`.

### 1.1 Tree

```
mvp/code/
├── pyproject.toml                    # uv-managed; deps + dev deps
├── uv.lock                            # commit vào git
├── alembic.ini
├── .env.example                       # TAD g07 §A full env vars
├── .python-version                    # 3.11 (uv pins)
├── Dockerfile                         # python:3.11-slim + uv install
│   # README.md ← PHASE 11 viết cuối, KHÔNG tạo trong Phase 0
│
├── alembic/
│   ├── env.py
│   └── versions/
│       └── 0001_initial_schema.py    # 16 tables + indexes
│
├── tests/
│   ├── conftest.py                   # in-memory SQLite + override get_db
│   ├── fixtures/
│   │   ├── tickers_5.py               # VHM, KDH, NLG, DXG, PDR (anchor)
│   │   ├── prices_ohlcv.py
│   │   ├── financials.py
│   │   ├── news_seed.py               # 150 articles (port từ FE mocks)
│   │   └── golden_outputs.py          # expected scores cho 5 mã
│   ├── unit/
│   │   ├── test_filters.py            # 4 rounds
│   │   ├── test_features.py           # 38 feature calc + normalize
│   │   ├── test_scoring.py            # baseline weighted sum
│   │   ├── test_entry.py              # priority order
│   │   ├── test_risk.py               # stop loss / allocation / badges
│   │   └── test_compare.py            # 4-section diff
│   └── integration/
│       ├── test_health.py
│       ├── test_auth.py
│       ├── test_run_lifecycle.py      # POST /run → polling → COMPLETED → results
│       ├── test_job_lock.py           # 409 khi 2 run song song
│       ├── test_share.py
│       └── test_telegram_test.py      # mock httpx
│
└── app/
    ├── __init__.py
    ├── main.py                        # FastAPI app + CORS + routers + envelope middleware
    ├── config.py                      # Pydantic Settings (env)
    ├── dependencies.py                # get_db, get_current_user, get_settings
    ├── job_lock.py                    # asyncio Lock; in-mem job_registry { id → status }
    │
    ├── api/                           # Router layer — KHÔNG business logic
    │   ├── __init__.py                # router = APIRouter(prefix="/api")
    │   ├── health.py                  # GET /health, GET /version
    │   ├── auth.py                    # POST /auth/login, PUT /auth/password
    │   ├── refresh.py                 # POST /refresh/all|prices, GET /refresh/{id}/status
    │   ├── screening.py               # POST /run, GET /runs, /runs/{id}, /runs/{id}/status, DELETE /runs/{id}
    │   ├── results.py                 # GET /runs/{id}/{results,dashboard,stocks/{t},compare/{b},excluded}
    │   ├── stocks.py                  # GET /stocks, /stocks/{t}, /stocks/{t}/prices
    │   ├── portfolio.py               # GET/POST/PUT/DELETE /portfolio
    │   ├── news.py                    # GET /news, /news/sentiment/{t}
    │   ├── backtest.py                # POST /backtest, GET /backtest/{id}{,/status,/results}
    │   ├── export.py                  # GET /export/pdf/{run_id} (binary)
    │   ├── share.py                   # POST/GET/GET-token/DELETE /share — GET-token PUBLIC
    │   ├── telegram.py                # POST /telegram/test
    │   └── settings.py                # GET/PUT /settings
    │
    ├── services/                      # Business logic — orchestrate engines + repos
    │   ├── __init__.py
    │   ├── auth_service.py            # login, change password, JWT issue
    │   ├── refresh_service.py         # async background driver, source-level cache
    │   ├── screening_service.py       # filter → score → predict → entry → risk → save
    │   ├── feature_service.py         # 38 feature calc + normalization (TAD c02)
    │   ├── filter_service.py          # 4-round filter pipeline (SRS f01)
    │   ├── risk_service.py            # stop loss, allocation, warnings, conf penalty
    │   ├── news_service.py            # query + sentiment aggregate (read-only MVP)
    │   ├── portfolio_service.py       # CRUD + validateHolding mirror (g02 §8.2)
    │   ├── backtest_service.py        # 2-stage polling, mock heuristic (g02 §8.5-6)
    │   ├── compare_service.py         # 4-section diff (g02 §8.3)
    │   ├── export_service.py          # weasyprint render
    │   ├── share_service.py           # uuid v4 + 7-day TTL
    │   └── telegram_service.py        # python-telegram-bot send + test
    │
    ├── engines/                       # Pluggable AI engines (TAD c01)
    │   ├── __init__.py
    │   ├── base.py                    # ABC: ScoringEngine, PriceEngine, EntryEngine
    │   ├── scoring_baseline.py        # weighted normalized sum của 38 features
    │   ├── scoring_xgboost.py         # STUB: load .pkl + predict; raises NotImplemented nếu chưa có model
    │   ├── price_baseline.py          # naive: target = current * (1 + trend_pct)
    │   ├── price_lstm.py              # STUB: load .h5 + predict
    │   └── entry_engine.py            # deterministic priority order (TAD c03)
    │
    ├── crawlers/                      # External I/O — rate-limited, cache-aware
    │   ├── __init__.py
    │   ├── vnstock_client.py          # rate limit 0.5s; price + financial fetch
    │   ├── news_crawler.py            # MVP: fixture loader; real RSS deferred
    │   ├── macro_crawler.py           # MVP: hardcoded constants; real SBV/GSO deferred
    │   └── cache_manager.py           # source-level TTL by data_type (TAD g04)
    │
    ├── models/                        # SQLAlchemy ORM — 16 tables (TAD g03)
    │   ├── __init__.py                # Base, register all models
    │   ├── stock.py                   # Stock, StockPrice
    │   ├── financial.py               # FinancialReport
    │   ├── macro.py                   # MacroData
    │   ├── run.py                     # ScreeningRun, ScreeningResult, ExcludedStock
    │   ├── news.py                    # NewsArticle
    │   ├── user.py                    # UserProfile
    │   ├── portfolio.py               # PortfolioHolding, Transaction
    │   ├── settings.py                # Settings (single row, id=1)
    │   ├── backtest.py                # BacktestRun, BacktestResult
    │   ├── share.py                   # ShareLink
    │   └── cache.py                   # CacheMetadata
    │
    ├── schemas/                       # Pydantic v2 — request + response shapes
    │   ├── __init__.py
    │   ├── envelope.py                # ApiSuccess[T], ApiError (chuẩn TAD g02 §6)
    │   ├── auth.py                    # LoginRequest/Response, PasswordChangeRequest/Response
    │   ├── refresh.py                 # RefreshStatusResponse
    │   ├── run.py                     # RunRequest, RunSummary (5 cluster-5 fields), RunStatusResponse
    │   ├── result.py                  # StockDetail, DashboardResponse, ResultsResponse
    │   ├── stock.py                   # StockListItem, LatestPrice
    │   ├── portfolio.py               # PortfolioCreate, PortfolioHolding
    │   ├── news.py                    # NewsArticle, NewsListResponse, SentimentSummaryResponse
    │   ├── backtest.py                # BacktestMetrics, BacktestResults
    │   ├── compare.py                 # CompareResponse 4-section
    │   ├── export.py                  # PdfExportMeta
    │   ├── share.py                   # ShareCreate/List/View
    │   ├── telegram.py                # TelegramTestResponse
    │   └── settings.py                # SettingsResponse, SettingsPatch
    │
    ├── repositories/                  # Data access — pure SQLAlchemy queries
    │   ├── __init__.py
    │   ├── base.py                    # generic CRUD helpers
    │   ├── stock_repo.py              # whitelist + price snapshots
    │   ├── price_repo.py              # OHLCV by ticker + date range
    │   ├── financial_repo.py
    │   ├── macro_repo.py
    │   ├── screening_repo.py          # screening_runs CRUD + status updates
    │   ├── results_repo.py            # screening_results bulk insert + query
    │   ├── excluded_repo.py
    │   ├── news_repo.py
    │   ├── portfolio_repo.py
    │   ├── backtest_repo.py
    │   ├── share_repo.py
    │   ├── settings_repo.py
    │   ├── user_repo.py
    │   └── cache_repo.py
    │
    ├── constants/                     # Domain constants (TAD g03 §L appendix)
    │   ├── __init__.py
    │   ├── features.py                # 38 IDs + normalization spec
    │   ├── enums.py                   # RunStatus 7-state, Recommendation, EntrySignal, NewsSource
    │   ├── thresholds.py              # buy=75, hold_min=45, badge thresholds
    │   ├── reason_codes.py            # whitelist (TAD c03)
    │   ├── error_codes.py             # ERR-XX-XX (SRS g01)
    │   └── sources.py                 # 5 news sources, vnstock data types
    │
    ├── core/                          # Cross-cutting infra
    │   ├── __init__.py
    │   ├── envelope.py                # success_response / error_response helpers
    │   ├── errors.py                  # AppError + global exception handlers
    │   ├── jwt.py                     # encode/decode (python-jose)
    │   ├── password.py                # bcrypt hash/verify (passlib)
    │   ├── logging.py                 # structlog config (TAD g05 §4)
    │   └── time.py                    # FIXTURE_NOW helpers (test mode)
    │
    └── db/
        ├── __init__.py
        ├── session.py                 # engine + SessionLocal + get_db dependency
        ├── pragmas.py                 # WAL + foreign_keys + busy_timeout (TAD g07)
        └── seed.py                    # whitelist 81 + default settings + initial user + 150 news
```

### 1.2 File-level responsibilities (key files only)

| File | Trách nhiệm cốt lõi |
|---|---|
| `app/main.py` | `FastAPI()` instance, CORS cho FE origin, mount `api.router`, gắn `core.errors` exception handlers, lifespan event chạy `db.pragmas.apply()` + warm cache |
| `app/config.py` | `class Settings(BaseSettings)`: DB_PATH, JWT_SECRET, JWT_TTL_HOURS, VNSTOCK_RATE_LIMIT_S=0.5, TELEGRAM_BOT_TOKEN, BUSY_TIMEOUT_MS, FRONTEND_ORIGIN, EXPORT_PDF_MODE (weasyprint\|html_mock) |
| `app/job_lock.py` | `class JobLock`: 1 asyncio.Lock + dict `{job_id: status}`. Service nào lock fail → raise `JobConflictError` → 409 |
| `app/services/screening_service.py` | Background task: `await job_lock.acquire('screening')`; chạy 4 round filter → feature → score → price → entry → risk → bulk insert results; update progress qua repo; release lock; **không** roundtrip qua HTTP |
| `app/engines/base.py` | `class ScoringEngine(ABC): def score(features: dict[str, float]) -> ScoringOutput` — interface để swap baseline ↔ xgboost qua DI |
| `app/crawlers/cache_manager.py` | `is_fresh(source: str) -> bool` đọc `cache_metadata.last_refreshed_at` + `ttl_hours`; chỉ refresh source nào stale |
| `app/core/envelope.py` | `def success(data: T) -> dict`; `def error(code, msg, detail=None) -> dict`. Mọi router return phải qua đây — đảm bảo TAD g02 §6 envelope đồng nhất, kể cả 409/500 |
| `app/core/errors.py` | `class AppError(Exception): code, http_status, message`. `@app.exception_handler(AppError)` → wrap envelope. `@app.exception_handler(RequestValidationError)` → ERR-VALIDATION-* |
| `app/db/seed.py` | Idempotent: whitelist 81 mã (port từ `frontend/src/mocks/data/whitelist.ts`), default settings row, initial user (password env-injected), 150 news articles port |

---

## 2. Frontend integration plan (Package 8–10)

> Goal: 1 environment toggle để chuyển `frontend/` từ MSW sang backend thực. KHÔNG đụng UI components.

### 2.1 Network layer changes

| File | Hành động |
|---|---|
| `frontend/src/lib/api.ts` | THÊM `const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';` rồi prepend cho mọi `path`. Khi BASE_URL empty → giữ behavior hiện tại (MSW relative). Khi set → call backend thực |
| `frontend/src/lib/types.ts` | Reconcile với Pydantic schemas (kỳ vọng đã match qua spec — kiểm tra lại field names + nullable) |
| `frontend/src/lib/constants.ts` | Xóa `MOCK_JWT_PREFIX` (real JWT). Giữ enum mirrors |
| `frontend/src/components/common/MswBootstrap.tsx` | Gate qua `NEXT_PUBLIC_ENABLE_MSW === 'true'`. Default OFF trong MVP env |
| `frontend/.env.local` (mới) | `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api` · `NEXT_PUBLIC_ENABLE_MSW=false` |

### 2.2 Stores → server source-of-truth migration

| Store | Hiện tại | Sau khi swap |
|---|---|---|
| `lib/stores/runs-store.ts` (singleton) | local state, mulberry32 generator, fake polling | THIN client: `start()` → POST /run; `get()` → GET /runs/{id}; subscriber pattern giữ nguyên cho UI; polling vẫn FE-driven |
| `lib/stores/portfolio-store.ts` | in-memory CRUD | thay bằng apiFetch CRUD; vẫn cache trong React Query / SWR pattern hiện có |
| `lib/stores/share-store.ts` | in-memory | apiFetch CRUD |
| `lib/stores/settings-store.ts` | in-memory + localStorage cho UI prefs | API cho persisted settings; localStorage chỉ giữ theme/language preview trước login |

### 2.3 Per-page integration checklist

| Page (route) | Endpoint dùng | Risk khi swap |
|---|---|---|
| `(auth)/login` | POST /auth/login | Token shape match `{token: string}` |
| `(app)/dashboard?run_id=` | GET /runs/{id}/dashboard | Aggregate field mapping (5 KPI + 5 charts) |
| `(app)/top-mua?run_id=` | GET /runs/{id}/results (filter rec=MUA) | Reasons + warning_badges parse JSON |
| `(app)/red-flags?run_id=` | GET /runs/{id}/excluded + GET /runs/{id}/results (warning rows) | Endpoint `/excluded` mới — cần thêm vào g02 (xem §5 drift) |
| `(app)/stock-detail?run_id=&ticker=` | GET /runs/{id}/stocks/{ticker} | Schema TAD g02 §4 — đã chốt |
| `(app)/price-board` | GET /stocks | LatestPrice anchor logic chuyển từ FE seed sang backend (TAD g02 §7.1) |
| `(app)/news` | GET /news + GET /news/sentiment/{ticker} | source_errors envelope (g02 §7.2) |
| `(app)/portfolio` | GET/POST/PUT/DELETE /portfolio | DELETE 200+envelope (g02 §8.1) |
| `(app)/run-history` | GET /runs + DELETE /runs/{id} + GET /runs/{a}/compare/{b} | Compare 4-section schema (g02 §8.3) |
| `(app)/run-history` Backtest panel | POST /backtest → GET /backtest/{id}/status (1.5s) → /backtest/{id} + /results | 2-stage polling (g02 §8.5) |
| `(app)/settings` | GET/PUT /settings + GET/DELETE /share + POST /telegram/test | validateSettingsPatch effective-state mirror server |
| `share/[token]` (PUBLIC) | GET /share/{token} (no auth) | Skip ProtectedRoute — đã đúng |

### 2.4 Export PDF

- Hiện FE prototype mở iframe srcDoc với HTML giả-PDF. Sau khi backend WeasyPrint ready: button download trỏ thẳng `window.open('/api/export/pdf/' + runId)` → browser tự download file binary qua `Content-Disposition: attachment` (g02 §9.1). Xóa iframe preview component.

### 2.5 Theme + i18n + Disclaimer (Package 10 polish)

- Không thay đổi — đã hoàn chỉnh trong prototype. Chỉ cần verify còn chạy sau khi swap MSW.

---

## 3. Build phases (sequential)

> Mỗi phase có **exit criteria** rõ ràng. Phase sau không bắt đầu khi phase trước không pass tests. **README.md = Phase 11 cuối cùng.**

| # | Phase | Estimate | Deliverable | Exit criteria |
|---|---|---|---|---|
| 0 | **Bootstrap** | 1d | Trong `mvp/code/`: `uv init` + `uv add fastapi uvicorn sqlalchemy alembic pydantic-settings python-jose passlib bcrypt structlog`, `uv add --dev pytest ruff`, alembic init, Dockerfile (multi-stage uv), `.env.example`, `app/main.py` với /health + /version, CORS allow `http://localhost:3000`, CI workflow (`uv run ruff check` + `uv run pytest`). KHÔNG viết README. | `uv run uvicorn app.main:app` start; `curl localhost:8000/api/health` → 200 envelope; `uv run pytest tests/integration/test_health.py` pass |
| 1 | **DB + Constants + Seed** | 1d | 16-table migration, ORM models, constants/, db/seed.py, port whitelist 81 + 150 news từ FE fixtures | `alembic upgrade head` clean; `python -m app.db.seed` xong → SQLite có 81 stocks + default settings + 1 user + 150 articles |
| 2 | **Auth + Settings** | 0.5d | POST /auth/login + JWT, PUT /auth/password, GET/PUT /settings, JWT middleware | FE login chạy thực (set ENV BASE_URL=...); change password reload token đúng (TAD c08 §5); settings PUT bump `version` |
| 3 | **Refresh layer** | 1.5d | vnstock_client (rate limit), cache_manager source-level, POST /refresh/all + /prices async 202, GET /refresh/{id}/status, in-mem job registry | Chạy refresh trên 5 mã anchor → DB có price + financial + cache_metadata.last_refreshed_at; polling status PROCESSING → COMPLETED |
| 4 | **Engines + Features + Risk** | 2d | 4-round filter, 38 feature calc + normalization, scoring_baseline, price_baseline, entry_engine, risk_service. ML stubs (xgboost/lstm) chỉ raise NotImplemented | `pytest tests/unit/test_{filters,features,scoring,entry,risk}.py` golden 5-mã pass với expected scores |
| 5 | **Screening Orchestrator** | 1d | POST /run async + job_lock 409, screening_service.run_pipeline, GET /runs/{id}/status (live duration), bulk insert results + excluded | `pytest tests/integration/test_run_lifecycle.py` end-to-end POST /run trên 81 mã → COMPLETED + 81 rows screening_results; 2 POST song song → 2nd 409 |
| 6 | **Read APIs** | 1d | GET /runs, /runs/{id}, /runs/{id}/{results,dashboard,stocks/{t},compare/{b},excluded}, /stocks, /stocks/{t}/prices, /news, /news/sentiment/{t} | FE swap MSW → real cho Dashboard + Top MUA + Red Flags + Stock Detail + Price Board + News → 6 page render đúng |
| 7 | **Personal & History** | 1d | Portfolio CRUD, DELETE /runs/{id}, compare 4-section | FE Portfolio + Run History + Compare panel chạy thực; DELETE 200+envelope OK |
| 8 | **Backtest + Export + Share + Telegram** | 1.5d | Backtest 2-stage polling, weasyprint render, share token CRUD + public route, telegram test/send | FE 4 features end-to-end: backtest panel show metrics + ROI chart; PDF download mở được; share link public view; telegram test toast |
| 9 | **FE swap full** | 0.5d | Set ENV vars, disable MSW worker, smoke test 8 page routes + 4 themes + VIE/EN | Tất cả page render đúng với backend; không còn MSW request trong DevTools Network |
| 10 | **Integration QA + bug fixes** | 1d | Run AC checklist 17 SRS files, regression theo cluster summaries §11 | Báo cáo test pass; tạo `report/mvp-build-summary.md` ghi nhận drift / TODO post-MVP |
| **11** | **README.md** | **0.5d** | Viết `mvp/README.md`: setup local (poetry install, alembic upgrade, seed, uvicorn run), env vars table, endpoint examples curl, troubleshooting (DB locked, vnstock fail, telegram token). Viết bằng tiếng Việt, ngắn — chỉ những gì tester/dev cần để chạy local | README.md tồn tại; clone repo + follow README → backend chạy + FE swap được trong < 15 phút |

**Tổng:** ~10.5 ngày work pack solo (chưa kể README 0.5d). Nếu chạy buổi/ngày cường độ vừa phải có thể giãn 12–14 ngày.

---

## 4. Risk register & mitigation

| Risk | Mitigation |
|---|---|
| vnstock library rate limit / data thiếu cho 1 số mã | `cache_manager` source-level + fallback giữ giá trị cũ; warning badge `STALE_DATA` đã có trong spec |
| WeasyPrint font tiếng Việt hiển thị sai | Embed font Inter + Noto Sans Vietnamese trong Docker image; test trước trên 1 PDF mẫu |
| Telegram bot token leak | Đọc qua env, KHÔNG commit `.env`. `/api/telegram/test` chỉ validate format trước khi gọi Bot API |
| FE/BE schema drift | Mỗi phase sau commit backend, chạy 1 page FE thực để verify shape ngay (không đợi đến Phase 9) |
| Job lock race khi server restart giữa run | In-mem registry mất → run "PROCESSING" cũ thành ghost. Khởi động backend mark mọi run PROCESSING > X phút thành FAILED với run_error="Server restart" (TAD g05) |
| Engine swap baseline → xgboost sau MVP | Đã chọn ABC pattern + DI; xgboost stub raise `NotImplementedError` để fail nhanh khi config trỏ sai |
| Endpoint thiếu trong g02 (e.g. `/runs/{id}/excluded` cho Red Flags) | Phase 6 phải audit danh sách endpoint FE đang gọi vs g02 registry; bổ sung endpoint mới trong cùng phase, update g02 đồng bộ |

---

## 5. Spec drift cần resolve trước Phase 6

> Audit ngắn lúc draft plan này — cần confirm với user trước khi build:

1. **Red Flags excluded list endpoint**: SRS f07 cần show "stocks bị filter ở 4 round" + warning table. g02 chưa có endpoint riêng. Đề xuất: thêm `GET /runs/{run_id}/excluded` (separation of concern, dashboard nhẹ hơn).
2. **News fixture vs RSS**: User chọn skip RSS. Backend Phase 6 GET /news đọc từ `news_articles` table (đã seed 150 articles). Không cần `news_crawler` thực — chỉ cần fixture loader.
3. **Macro data**: Stub bằng constants trong `constants/macro_defaults.py` + 1 row macro_data seed. Đủ cho 38 features cần macro inputs.
4. **PDF mode flag**: `EXPORT_PDF_MODE=weasyprint` cho production; `=html_mock` cho dev không có WeasyPrint installed (port logic prototype). Phase 8 ship cả hai mode để dễ dev.

---

## 6. Out of MVP (post-MVP backlog)

- XGBoost training pipeline + scoring_xgboost real (Phase post-MVP)
- LSTM training + price_lstm real
- News RSS crawler + sentiment ML pipeline thực (hiện fixture)
- Macro crawler thực (SBV/GSO scraping)
- Backtest strict per PRD §4.5 (hiện mock heuristic)
- Multi-user, RBAC (hiện single-user MVP)
- Frontend rebuild theo TAD-only spec (KHÔNG làm — prototype đã được duyệt)

---

*— End of MVP Build Plan v1 —*
