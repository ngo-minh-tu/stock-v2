# VN Real Estate AI Screener

> *Slogan: Dữ liệu dẫn đường, quyết định thuộc về bạn* — Founder: Ngô Minh Tú

AI-assisted screener cho cổ phiếu bất động sản niêm yết Việt Nam. Single-user MVP — frontend Next.js + backend FastAPI + SQLite.

**Status (2026-05-24):** MVP Phase 0-28 đã ship + post-Phase deferral closure cho **Macro real crawler**, **Backtest strict PRD §4.5**, **Turbopack migration**. **Mốc 1+2+3+4 + Track 1+2+3+4+5+6 đóng.** Prod DB scored=17 với real vnstock data; financial values khớp CafeF (NLG revenue 1.279T VND, total_assets 25.894T VND). FE Next **16.2.6** + next-intl 4.12.0, `npm run dev/build` dùng Turbopack default (không còn `--webpack`). Playwright critical-path **8/8 pass**. InfoBanner dismiss + LocalStorage persist (Phase 28). Telegram 429 retry. Consolidated sanity guards. Extensible production secret-file guard. Period suffix log DEBUG. `useExportPdf` binary-safe (Phase 27). PriceBoard "Chưa có dữ liệu" placeholder. bvps fallback + KBS snapshot (Phase 26). Schema FE `latest_price`→`latest` (Phase 25). 3 disclaimer banner. Telegram broadcast wired. `docker-compose.yml` + `script/nginx.conf` + `docs/DEPLOY.md` production deploy template. BE **311/311 tests** baseline; latest targeted deferral regression **55/55 pass** + Turbopack build 14 routes pass. 0 known BE vulns · FE 0 critical. **Next:** operator deploy via Phase 27 template + `script/pre-handoff-refresh.sh` → ngrok hand-off → trader feedback → Phase 29+ optional.

---

## 1. Bắt đầu

| Tôi muốn… | Đi tới |
|---|---|
| Chạy backend local | [mvp/README.md](mvp/README.md) — uv sync + alembic + seed + uvicorn (5 phút) |
| Chạy frontend local | [frontend/README.md](frontend/README.md) — npm install + .env.local + npm run dev |
| Xem build history + drift register | [report/mvp-build/SUMMARY.md](report/mvp-build/SUMMARY.md) |
| Đọc spec (PRD/SRS/TAD) | [docs/](docs/) |
| Audit từng phase | [mvp/phases/](mvp/phases/) — SUMMARY.md per phase |

Quick start full stack:
```bash
# Terminal 1 — backend demo ổn định
cd mvp/code && uv sync
cp env.demo.example .env
uv run python -m app.db.demo_seed
uv run uvicorn app.main:app --port 8000

# Terminal 2 — frontend
cd frontend && npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
echo "NEXT_PUBLIC_ENABLE_MSW=false" >> .env.local
npm run dev
# → http://localhost:3000 (login password: ChangeMe123!)
```

---

## 2. Monorepo layout

```
stock-v2/
├── README.md             # ← bạn đang đọc
├── mvp/                  # Backend FastAPI (active)
│   ├── README.md
│   ├── code/             # source backend + tests + Dockerfile + env templates
│   └── phases/           # SUMMARY.md + REVIEW.md per phase (0-28) + phase-29 draft backlog
├── frontend/             # Frontend Next.js 16.2.6 (active, post-Phase 9 swap)
│   ├── README.md
│   └── src/              # app router + components + lib
├── prototype/            # FE prototype FROZEN 2026-05-08 (cluster 1-6 reference)
├── docs/                 # PRD v0.5A + SRS v1.4 + TAD v1.5 + design.md
│   ├── PRD_v0.5A_Final_Locked.md
│   ├── srs/              # f01-f17 + g01-g04
│   ├── tad/              # g01-g08 + c01-c10
│   ├── design.md
│   └── system-architecture/
├── plan/                 # PLAN.md (Phase 29+ build/backlog plan, promoted from mvp/ 2026-05-16)
├── report/               # Báo cáo theo folder chủ đề
│   ├── cluster-prompts/  # cluster-{1..6}-summary.md (prototype)
│   ├── mvp-build/        # SUMMARY.md (drift register + backlog)
│   └── phase-mvp/        # phase-1 ... phase-28, mỗi folder 1 SUMMARY.md (tiếng Việt user-facing)
├── script/               # Bash helpers (run FE/BE, e2e backend, ngrok, backup/restore, refresh, nginx)
└── prompts/              # Cluster build prompts
```

`prototype/` đã frozen, KHÔNG develop tiếp. FE active = `frontend/` (forked 2026-05-09).

---

## 3. Stack tóm tắt

| Layer | Choice | Lý do |
|---|---|---|
| Frontend | Next.js 16.2.6 (App Router) + Tailwind | TAD g08 §FE pattern |
| Charts | lightweight-charts (candlestick) + Recharts (radar/treemap/line) | TAD c10 + g08 |
| State | React Context + custom stores singleton | TAD c04 |
| API mock (dev) | MSW (opt-in via `NEXT_PUBLIC_ENABLE_MSW=true`) | Phase 9 §2 |
| Backend | FastAPI + uvicorn + uv 0.11 | PLAN.md §0 |
| DB | SQLite + SQLAlchemy 2 + Alembic | TAD g07 (single-user) |
| Auth | JWT (python-jose) + bcrypt | TAD c08 |
| Engines | Baseline scoring/price/entry — ABC interface cho XGBoost/LSTM swap post-MVP | PRD §4.3-4.5 |
| External | vnstock (real) · 5 news sources (fixture MVP) · WeasyPrint (PDF) · python-telegram-bot | PLAN.md §0 |

---

## 4. Phase ledger

| # | Phase | Status |
|---|---|---|
| 0 | Bootstrap | ✅ |
| 1 | DB + Constants + Seed | ✅ |
| 2 | Auth + Settings | ✅ |
| 3 | Refresh layer | ✅ |
| 4 | Engines + Features + Risk | ✅ |
| 5 | Screening Orchestrator | ✅ |
| 6 | Read APIs | ✅ |
| 7 | Personal & History | ✅ |
| 8 | Backtest + Export + Share + Telegram | ✅ |
| 9 | FE swap MSW → real | ✅ |
| 10 | Integration QA + bug fixes | ✅ |
| 11 | README | ✅ |
| 12 | Production-data QA | ✅ |
| 13 | Demo stability / DB isolation | ✅ |
| 14 | Production Data Hardening (Mốc 2 prices code) | ✅ |
| 15 | Financial Data Ingestion (Mốc 2 BCTC code) | ✅ |
| 16 | MVP Data Readiness Closure (Mốc 2 thật) | ✅ |
| 17 | Financial Source Fallback (Mốc 3 step 1, VCI→KBS) | ✅ |
| 18 | MVP Release Hardening (Mốc 3 steps 2-7) | ✅ |
| 19 | Playwright critical-path smoke (Mốc 3 step 8) | ✅ |
| 20 | Telegram Real-Send Verify (Mốc 3 step 9) | ✅ |
| 21 | Financial Quality + No-Downgrade Upsert (Mốc 4 step 1) | ✅ |
| 22 | Financial Unit Scaling + Production Guards (Mốc 4 step 2) | ✅ |
| 23 | Telegram Run-Summary Broadcast + Config-Layer Pytest (Track 2) | ✅ |
| 24 | FE Next 16 Security Upgrade (Track 1 — BLOCKING ngrok cleared) | ✅ |
| 25 | Pre-Handoff UX Polish + Schema Rename + Sanity Guard (Track 5) | ✅ |
| 26 | KBS Data Polish — bvps Fallback + Period Suffix Lock + Snapshot (Track 3) | ✅ |
| 27 | Deploy Polish + useExportPdf + PriceBoard Placeholder + Equity Sanity (Track 4 baseline) | ✅ |
| 28 | Polish Batch — Dismiss + 429 Retry + Sanity Consolidate + Prod Guard + Log Tuning + Test Flake (Track 6) | ✅ |
| 29+ | Operator deploy → ngrok hand-off → trader feedback → optional polish | ⏭ next |

**Mốc 1+2+3+4 + Track 1+2+3+4+5+6 đóng.** Production deploy template ready (NOT live-deployed). Operator wires hosting + SSL + `docker compose up -d` + `script/pre-handoff-refresh.sh` → ngrok. Chi tiết: [plan/PLAN.md §6-7](plan/PLAN.md) + [docs/DEPLOY.md](docs/DEPLOY.md). Phase 16-28 deliverables: [phase-16](mvp/phases/phase-16-mvp-data-readiness-closure/), [phase-17](mvp/phases/phase-17-financial-source-fallback/), [phase-18](mvp/phases/phase-18-mvp-release-hardening/), [phase-19](mvp/phases/phase-19-playwright-smoke/), [phase-20](mvp/phases/phase-20-telegram-real-send-verify/), [phase-21](mvp/phases/phase-21-financial-quality-no-downgrade/), [phase-22](mvp/phases/phase-22-financial-unit-scaling/), [phase-23](mvp/phases/phase-23-telegram-broadcast-config-env/), [phase-24](mvp/phases/phase-24-fe-next16-security-upgrade/), [phase-25](mvp/phases/phase-25-pre-handoff-ux-polish/), [phase-26](mvp/phases/phase-26-kbs-data-polish/), [phase-27](mvp/phases/phase-27-deploy-polish/), [phase-28](mvp/phases/phase-28-polish-batch/). Vietnamese user-facing log: [report/phase-mvp/](report/phase-mvp/).

---

## 5. Bảng chú thích File & Folder (purpose annotation)

> Chú thích công dụng từng folder/file, lồng nhau từ cha → con → cháu. Cây `mvp/` được mô tả chi tiết nhất (theo từng file); các cây khác mô tả 1 cấp + gọi tên các file trọng yếu. **Đọc section này đầu tiên khi điều hướng repo.**

### 5.1 Repo root (`stock-v2/`)

| Path | Công dụng |
|---|---|
| `README.md` | Chính file này. Cửa ngõ vào project — quickstart, layout, phase ledger, reference. |
| `docker-compose.yml` | Template deploy production (Phase 27). Dựng backend + nginx phục vụ hand-off qua ngrok. Không dùng cho local dev. |
| `.gitignore` | Loại trừ `node_modules/`, `.next/`, build cache, secrets `.env*`, backend DB/cache và log local. |
| `docs/` | Source of truth cho spec (PRD, SRS, TAD, design, deploy). Đọc trước khi sửa code. |
| `mvp/` | **Codebase backend FastAPI active** + build log theo phase. Mô tả chi tiết bên dưới. |
| `frontend/` | Codebase frontend Next.js 16.2.6 active (fork từ `prototype/` ngày 2026-05-09). |
| `prototype/` | FE prototype gốc, **FROZEN 2026-05-08**. Chỉ dùng tham chiếu cho cluster 1-6 — không sửa. |
| `plan/` | Build plan dẫn dắt việc làm phase. |
| `prompts/` | Cluster build prompts dùng để dẫn dắt prototype (tham chiếu lịch sử). |
| `report/` | Báo cáo user-facing tiếng Việt theo phase + drift register. Là artifact output, không phải source. |
| `script/` | Bash helpers (run FE/BE, DB backup/restore, cron refresh, ngrok, nginx config). |
| `.claude/`, `.pytest_cache/`, `test-results/` | Artifact/tool state local trong workspace hiện tại. Không phải source of truth. |

### 5.2 `docs/` — Spec & architecture

| Path | Công dụng |
|---|---|
| `docs/PRD_v0.5A_Final_Locked.md` | Product Requirements Document v0.5A. Phạm vi sản phẩm đã chốt. |
| `docs/DEPLOY.md` | Runbook deploy cho operator (Phase 27). |
| `docs/design.md` | Ghi chú design cross-cutting (UX pattern, quy tắc màu, quyết định layout). |
| `docs/srs/` | Software Requirements Specification — contract theo từng feature. |
| `docs/tad/` | Technical Architecture Document — design theo từng component. |
| `docs/system-architecture/` | Diagram/note kiến trúc high-level (context, layers, ERD, flows). |

**`docs/srs/`** — yêu cầu theo feature:
| File | Công dụng |
|---|---|
| `00-srs-system-overview.md` | Hướng dẫn đọc SRS + quy ước ID. |
| `f01-core-screening-pipeline.md` | Contract pipeline screener lõi. |
| `f02-feature-engineering.md` | Spec dict 38 feature. |
| `f03-entry-point-logic.md` | Contract engine entry-signal. |
| `f04-dashboard-market-overview.md` | Spec dashboard widgets. |
| `f05-price-board.md` | Quy tắc 5 màu TTCK của Price Board. |
| `f06-top-mua-explainability.md` | Contract Top-mua + reason codes. |
| `f07-red-flags-risk-warnings.md` | Từ điển risk-flag. |
| `f08-stock-detail.md` | Composition trang stock detail. |
| `f09-risk-management.md` | Knob quản trị rủi ro. |
| `f10-news-sentiment.md` | News corpus + sentiment doughnut. |
| `f11-portfolio-lite.md` | Portfolio lite store + CRUD. |
| `f12-run-history-backtest.md` | Run history + backtest 2-stage polling. |
| `f13-export-share.md` | PDF export + public share. |
| `f14-telegram-bot.md` | Telegram broadcast bot. |
| `f15-settings.md` | Settings (validate effective-state). |
| `f16-authentication.md` | Single-user JWT auth. |
| `f17-theme-i18n.md` | Theme + locale (vi/en). |
| `g01-global-errors-and-validation.md` | Envelope error toàn cục + quy tắc validate. |
| `g02-non-functional-requirements.md` | Target performance / availability. |
| `g03-appendix-enums-constants.md` | Bảng enum + constant (single source). |
| `g04-vibecoding-order.md` | Hướng dẫn thứ tự build cho AI-assisted dev. |

**`docs/tad/`** — design technical/architecture:
| File | Công dụng |
|---|---|
| `00-tad-system-overview.md` | Hướng dẫn đọc TAD. |
| `c01-engines.md` … `c10-stock-detail-chart.md` | Design component-level (engines, feature eng., entry, news, dashboard, PDF, telegram, auth, theme/i18n, chart stock-detail). |
| `g01-runtime.md` … `g08-coding-packages.md` | Design toàn cục (runtime, API, DB, cache, cross-cutting, testing, deployment, coding packages). |

**`docs/system-architecture/`** — diagram high-level:
| File | Công dụng |
|---|---|
| `README.md` | Thứ tự đọc. |
| `01-system-context.md` | C4 context diagram + actor ngoài. |
| `02-backend-layers.md` | Kiến trúc backend phân lớp. |
| `03-frontend-stack.md` | Stack FE & rendering model. |
| `04-runtime-flows.md` | Flow runtime end-to-end (refresh, screening, export, share). |
| `05-database-erd.md` | ERD schema SQLite. |
| `06-feature-pipeline.md` | Diagram pipeline 38 feature. |
| `07-cache-cross-cutting.md` | Cache layer + cross-cutting. |

### 5.3 `mvp/` — Backend FastAPI (CHI TIẾT)

`mvp/` có 2 nhánh con: **`code/`** (source of truth của backend) và **`phases/`** (changelog overlay theo phase, mô tả đã thêm/sửa CÁI GÌ trong `code/` ở mỗi phase). Hai nhánh này gắn chặt — xem §5.3.3 cho mối quan hệ.

#### 5.3.1 `mvp/README.md`
Quickstart backend: `uv sync`, alembic upgrade, seed, lệnh chạy `uvicorn`. Đọc trước khi boot backend.

#### 5.3.2 `mvp/code/` — Source backend

| Path | Công dụng |
|---|---|
| `Dockerfile` | Image container backend (template deploy Phase 27). |
| `entrypoint.sh` | Entrypoint container — alembic upgrade + launch uvicorn. |
| `pyproject.toml` | Manifest project uv (deps, dev-deps, tool config). |
| `uv.lock` | Lockfile dep đã pin. |
| `alembic.ini` | Config migration Alembic. |
| `.env.example` / `env.demo.example` / `env.production.example` / `.env` / `.env.telegram` | Template env + env runtime local: dev / demo / production / chain telegram secrets. `.env` và `.env.telegram` **gitignored**. |
| `.dockerignore` / `.gitignore` | Loại trừ file thừa khi build Docker / commit trong subtree backend. |
| `.python-version` | Pin version Python (uv đọc file này). |
| `data/` | File SQLite DB (`screener.db`, `demo-screener.db`, `prod-screener.db`, `test-screener.db`) + `sample-export.pdf`. `*.db-shm/-wal` là journal WAL. |
| `alembic/` | Migration scripts (`versions/`) + env/template. |
| `app/` | Source FastAPI — xem breakdown. |
| `tests/` | Bộ pytest (311 test) — xem breakdown. |

##### `mvp/code/app/` — package application

| File / Folder | Công dụng |
|---|---|
| `main.py` | FastAPI app factory + wiring router + production guard (chặn load từ env file cấm). |
| `config.py` | Loader config pydantic-settings chain tuple (`.env` → `.env.telegram`). |
| `dependencies.py` | Factory FastAPI dependencies (DB session, auth user, settings). |
| `job_lock.py` | Job lock in-process cho screening/refresh single-flight. |
| `api/` | HTTP router (FastAPI APIRouter theo resource). |
| `constants/` | Bảng enum + constant (single source, mirror `docs/srs/g03`). |
| `core/` | Primitive cross-cutting (envelope, errors, JWT, password). |
| `crawlers/` | Adapter dữ liệu ngoài (vnstock client, RSS/news crawler, cache manager). |
| `db/` | Plumbing DB (session, pragmas, seed). |
| `engines/` | Engine scoring + price + entry (ABC interface — impl baseline + stub post-MVP). |
| `models/` | SQLAlchemy ORM model (mỗi file một aggregate). |
| `repositories/` | Layer DB access (helper query/upsert theo model). |
| `schemas/` | Pydantic request/response DTO (theo resource). |
| `services/` | Layer business logic (mỗi service một use case). |

**`app/api/`** — HTTP endpoints:
| File | Công dụng |
|---|---|
| `auth.py` | POST `/auth/login`, `/auth/refresh` (JWT). |
| `backtest.py` | POST/GET backtest jobs (2-stage polling). |
| `export.py` | GET PDF export. |
| `health.py` | GET `/health`. |
| `news.py` | GET news corpus + sentiment. |
| `portfolio.py` | CRUD `/portfolio/holdings`. |
| `refresh.py` | POST refresh job (single-flight qua `job_lock`). |
| `results.py` | GET screening results / latest run. |
| `screening.py` | POST screening run. |
| `settings.py` | GET/PUT user settings (validate effective-state). |
| `share.py` | POST/GET public share token. |
| `stocks.py` | GET stock detail + features. |
| `telegram.py` | POST trigger telegram broadcast. |

**`app/constants/`** — bảng single-source:
| File | Công dụng |
|---|---|
| `enums.py` | Enum status / role / source. |
| `error_codes.py` | Dict error code API. |
| `features.py` | Whitelist + metadata 38 feature. |
| `reason_codes.py` | Whitelist reason-code cho Top-mua. |
| `sources.py` | Danh sách 5 news source (fixture). |
| `thresholds.py` | Constant threshold scoring / risk. |

**`app/core/`** — primitives:
| File | Công dụng |
|---|---|
| `envelope.py` | Envelope `{data, error}` chuẩn cho response. |
| `errors.py` | Hierarchy exception + handler exception FastAPI. |
| `jwt.py` | Encode/decode JWT (python-jose). |
| `password.py` | bcrypt hash + verify. |

**`app/crawlers/`** — adapter ngoài:
| File | Công dụng |
|---|---|
| `vnstock_client.py` | Wrapper SDK vnstock — fetch prices + BCTC, có chain fallback (VCI → KBS). |
| `news_sources.py` | Registry nguồn RSS/tin tức được crawler đọc. |
| `news_rss.py` | RSS crawler/parser cho news ingestion. |
| `macro_crawler.py` | Macro crawler real-source best-effort: World Bank indicators + VN-Index qua vnstock; seed giữ vai trò fallback baseline. |
| `cache_manager.py` | Cache theo symbol kèm STUB fallback (Phase 16+). |

**`app/db/`** — plumbing DB:
| File | Công dụng |
|---|---|
| `session.py` | Engine SQLAlchemy + factory session (sync; threadpool). |
| `pragmas.py` | Set PRAGMA SQLite (WAL, foreign_keys, …). |
| `seed.py` | Seed data shape production. |
| `demo_seed.py` | Seed demo DB (ổn định cho local dev). |

**`app/engines/`** — layer engine pluggable:
| File | Công dụng |
|---|---|
| `base.py` | ABC interface engine (scoring / price / entry). |
| `scoring_baseline.py` | Engine scoring baseline (đã ship MVP). |
| `scoring_xgboost.py` | Engine XGBoost post-MVP (stub). |
| `price_baseline.py` | Engine price baseline. |
| `price_lstm.py` | Engine price LSTM post-MVP (stub). |
| `entry_engine.py` | Engine entry-signal (anchor-based). |

**`app/models/`** — ORM aggregate (mỗi file một family bảng):
| File | Công dụng |
|---|---|
| `user.py` | Single-user. |
| `stock.py` | Symbol master + sector. |
| `financial.py` | BCTC fundamentals (quarterly + annual). |
| `macro.py` | Macro indicators. |
| `news.py` | News articles + sentiment. |
| `portfolio.py` | Bảng holdings. |
| `run.py` | Run header + items của screening. |
| `backtest.py` | Backtest jobs + results. |
| `share.py` | Public share token. |
| `settings.py` | User settings. |
| `cache.py` | Cache snapshot. |

**`app/repositories/`** — DB access (chủ yếu mirror models 1-1):
| File | Công dụng |
|---|---|
| `user_repo.py` / `stock_repo.py` / `financial_repo.py` / `macro_repo.py` / `news_repo.py` / `portfolio_repo.py` / `price_repo.py` / `results_repo.py` / `screening_repo.py` / `backtest_repo.py` / `share_repo.py` / `settings_repo.py` / `cache_repo.py` / `excluded_repo.py` | Helper query/upsert theo resource. `financial_repo` enforce no-downgrade upsert (Phase 21). |

**`app/schemas/`** — pydantic DTO (theo resource):
| File | Công dụng |
|---|---|
| `auth.py` / `backtest.py` / `compare.py` / `envelope.py` / `news.py` / `portfolio.py` / `refresh.py` / `result.py` / `run.py` / `settings.py` / `share.py` / `stock.py` / `telegram.py` | Shape request/response. `envelope.py` là wrapper generic `{data, error}`. |

**`app/services/`** — business logic (mỗi file một use case):
| File | Công dụng |
|---|---|
| `auth_service.py` | Login + refresh token. |
| `backtest_service.py` | Orchestrate backtest job; correctness strict theo PRD §4.5 (MUA outperform VN-Index, BÁN underperform/negative, GIỮ trong band). |
| `compare_service.py` | Hàm pure compare-compute (4-branch toggle). |
| `dashboard_service.py` | Aggregation dashboard. |
| `export_service.py` | PDF export (WeasyPrint). |
| `feature_service.py` | Pipeline compute 38 feature. |
| `filter_service.py` | Filter chain screening. |
| `news_service.py` | Fetch news + aggregate sentiment. |
| `news_crawl_service.py` | Điều phối crawl RSS/news real-source rồi lưu vào DB. |
| `sentiment_rule.py` | Rule-based sentiment classifier cho tin tức. |
| `portfolio_service.py` | Holdings CRUD + valuation. |
| `refresh_service.py` | Orchestrate refresh (vnstock prices + BCTC + macro crawler best-effort). |
| `results_service.py` | Read API kết quả. |
| `risk_service.py` | Rule engine red-flag. |
| `screening_service.py` | Orchestrate screening run. |
| `settings_service.py` | Validate effective-state cho settings. |
| `share_service.py` | Mint share token + public read. |
| `stock_service.py` | Compose stock detail. |
| `telegram_service.py` | Telegram broadcast (429 retry — Phase 28). |

##### `mvp/code/tests/` — bộ pytest

| Path | Công dụng |
|---|---|
| `conftest.py` | Fixture gốc (app, client, DB isolation). |
| `fixtures/anchor_features.py` | Fixture feature anchor entry-signal. |
| `fixtures/kbs_snapshot.py` | Fixture snapshot BCTC KBS (Phase 26). |
| `unit/` | Test unit pure-function (engines, features, filters, cache, telegram, JWT lock, config, models, risk, scoring, vnstock client, prod guard). |
| `integration/` | Test HTTP-level qua TestClient (mỗi file một API resource — `test_auth.py`, `test_backtest.py`, …). `test_db_isolation.py` enforce isolation DB test. |

#### 5.3.3 `mvp/phases/` — Changelog overlay theo phase

> **Quan hệ với `mvp/code/`:** mỗi folder `phase-N-<slug>/` ghi lại CÁI GÌ đã thêm/sửa trong `mvp/code/` ở phase N. Đó là **lớp changelog phủ** lên snapshot `code/` live. Đọc `mvp/code/` để biết trạng thái HIỆN TẠI; đọc `mvp/phases/phase-N/SUMMARY.md` để biết TẠI SAO file đó trông như vậy.

| File trong mỗi folder | Công dụng |
|---|---|
| `SUMMARY.md` | Đã ship gì (file thêm/sửa dưới `mvp/code/app/<layer>/<file>`, test thêm, AC đã đóng). |
| `REVIEW.md` | Re-read self-critical (drift, regression risk, gap). [[feedback_phase_3_artifact_rule]] |

Phase folder 0-28 (mirror phase ledger §4) + phase-29 draft backlog:
- `phase-0-bootstrap/` ↔ scaffold `mvp/code/` ban đầu.
- `phase-1-db-constants-seed/` ↔ `app/models/`, `app/constants/`, `app/db/seed.py`, `alembic/versions/`.
- `phase-2-auth-settings/` ↔ `app/api/auth.py`, `app/services/auth_service.py`, `app/core/jwt.py`, `app/core/password.py`, stack settings.
- `phase-3-refresh-layer/` ↔ `app/services/refresh_service.py`, `app/api/refresh.py`, `app/crawlers/vnstock_client.py`, `app/job_lock.py`.
- `phase-4-engines-features-risk/` ↔ `app/engines/*`, `app/services/feature_service.py`, `app/services/risk_service.py`.
- `phase-5-screening-orchestrator/` ↔ `app/services/screening_service.py`, `app/services/filter_service.py`.
- `phase-6-read-apis/` ↔ `app/api/results.py` (bao gồm `/runs/{run_id}/dashboard`), `app/api/stocks.py`, `app/api/news.py`.
- `phase-7-personal-history/` ↔ `app/api/portfolio.py`, `app/services/portfolio_service.py`, query run history.
- `phase-8-backtest-export-share-telegram/` ↔ `app/api/{backtest,export,share,telegram}.py` + service tương ứng.
- `phase-9-fe-swap/` ↔ wire `frontend/` sang backend thật (chủ yếu FE; backend freeze contract).
- `phase-10-integration-qa/` ↔ fix cross-cutting trong `app/services/*`, thêm test integration.
- `phase-11-readme/` ↔ README này + `mvp/README.md`.
- `phase-12-production-data-qa/` ↔ quality gate `app/services/refresh_service.py`.
- `phase-13-demo-stability/` ↔ `app/db/demo_seed.py`, DB isolation cho test.
- `phase-14-production-data-hardening/` ↔ hardening price `app/crawlers/vnstock_client.py`.
- `phase-15-financial-ingestion/` ↔ `app/repositories/financial_repo.py`, ingest BCTC.
- `phase-16-mvp-data-readiness-closure/` ↔ STUB fallback `app/crawlers/cache_manager.py`.
- `phase-17-financial-source-fallback/` ↔ fallback VCI→KBS trong `vnstock_client.py`.
- `phase-18-mvp-release-hardening/` ↔ hardening release đa file (envelope, validation, guards).
- `phase-19-playwright-smoke/` ↔ `frontend/tests/e2e/` + vài fix schema BE lộ qua E2E.
- `phase-20-telegram-real-send-verify/` ↔ verify real-send `app/services/telegram_service.py`.
- `phase-21-financial-quality-no-downgrade/` ↔ no-downgrade upsert `app/repositories/financial_repo.py`.
- `phase-22-financial-unit-scaling/` ↔ unit-scaling + production guard `app/main.py`.
- `phase-23-telegram-broadcast-config-env/` ↔ broadcast `app/services/telegram_service.py` + env chain `app/config.py`.
- `phase-24-fe-next16-security-upgrade/` ↔ FE-only (Next 16.2.6).
- `phase-25-pre-handoff-ux-polish/` ↔ rename schema + sanity guard + FE polish (gắn với `script/pre-handoff-refresh.sh`).
- `phase-26-kbs-data-polish/` ↔ bvps fallback `vnstock_client.py` + `tests/fixtures/kbs_snapshot.py`.
- `phase-27-deploy-polish/` ↔ `docker-compose.yml` + `script/nginx.conf` + `docs/DEPLOY.md` + `useExportPdf`.
- `phase-28-polish-batch/` ↔ `telegram_service.py` 429 retry + sanity consolidated + prod guard extensible + period-suffix log + fix test flake.
- `phase-29-DRAFT-backlog/` ↔ backlog nháp hậu bàn giao; chưa phải phase đã ship.

### 5.4 `frontend/` — Frontend Next.js

| Path | Công dụng |
|---|---|
| `README.md` | Quickstart FE (`npm install`, `.env.local`, `npm run dev`). |
| `package.json` / `package-lock.json` | Manifest + lockfile npm (Next 16.2.6, next-intl 4.12.0); scripts dùng Turbopack default, không còn `--webpack`. |
| `next.config.js` | Config Next.js tối giản; webpack alias/pin đã bỏ sau Turbopack migration. |
| `tsconfig.json` / `tsconfig.tsbuildinfo` | Config TS + cache build incremental. |
| `tailwind.config.ts` / `postcss.config.js` | Tailwind + PostCSS. |
| `playwright.config.ts` | Config E2E Playwright. |
| `.eslintrc.json` | Rule ESLint. |
| `next-env.d.ts` | TS types global Next.js. |
| `.env.local` | Env local (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_ENABLE_MSW`). |
| `public/` | Static asset (`mockServiceWorker.js` cho MSW). |
| `tests/e2e/` | Smoke critical-path Playwright (8/8). |
| `.next/`, `node_modules/`, `playwright-report/`, `test-results/` | Artifact local sinh ra khi build/test. Không phải source of truth. |
| `src/` | Source app — xem dưới. |

**`frontend/src/`**:
| Path | Công dụng |
|---|---|
| `app/` | App Router Next.js. `(app)/` = route gác auth; `(auth)/` = login; `share/` = route public share-token (ngoài `(app)`). `layout.tsx`, `icon.tsx`, `apple-icon.tsx`. |
| `components/` | UI component nhóm theo feature: `auth/`, `backtest/`, `badges/`, `charts/`, `common/`, `dashboard/`, `export/`, `layout/`, `news/`, `portfolio/`, `price-board/`, `run/`, `run-history/`, `settings/`, `share/`, `stock-detail/`, `tables/`, `telegram/`. `charts/ResponsiveChart.tsx` và `common/InfoBanner.tsx` là additions hậu FE swap. |
| `contexts/` | React Contexts: `AuthContext`, `LocaleContext`, `MockOutcomeContext`, `RunContext`, `ThemeContext`, `ToastContext`. |
| `lib/api.ts` | API client có type. |
| `lib/types.ts` | Type FE shared (mirror pydantic schema BE). |
| `lib/constants.ts` | Constant FE. |
| `lib/hooks/` | Custom hooks (`useExportPdf`, …). |
| `messages/en.json`, `messages/vi.json` | Message catalog next-intl. |
| `mocks/handlers.ts` | Handler request MSW. |
| `mocks/data/` | Fixture data MSW (vd. `price-board-fixture.ts`). |
| `styles/globals.css`, `styles/themes.css` | Tailwind layer + theme token. |

### 5.5 `prototype/` — Reference FROZEN

Layout Next.js giống `frontend/`. **Không sửa.** Chỉ dùng tham chiếu visual/behavior (cluster 1-6) cho `frontend/` active fork. Frozen 2026-05-08.

### 5.6 `plan/`, `prompts/`, `report/`

**`plan/`**:
| File | Công dụng |
|---|---|
| `PLAN.md` | Build plan đến Phase 29+ (promote từ `mvp/PLAN.md` ngày 2026-05-16). Track quyết định Mốc & Track. |

**`prompts/`** — cluster build prompts (lịch sử):
| File | Công dụng |
|---|---|
| `cluster-1-shell-foundation.md` … `cluster-6-export-integrations.md` | Cluster prompt gốc dùng dẫn dắt build prototype. Chỉ tham chiếu. |

**`report/`** — artifact user-facing:
| Path | Công dụng |
|---|---|
| `README.md` | Index báo cáo. |
| `cluster-prompts/cluster-{1..6}-summary.md` | Summary mỗi cluster từ thời prototype. |
| `mvp-build/SUMMARY.md` | SUMMARY MVP build: drift register, backlog, health cross-phase. |
| `phase-mvp/phase-N-<slug>/` | Báo cáo tiếng Việt user-facing theo phase (mirror `mvp/phases/`, audience = PO). |

### 5.7 `script/` — Bash helpers (chi tiết liên hệ chéo)

> Mỗi script đặt cạnh nội dung phụ thuộc: tên file backend/FE/docs/phase nào nó gọi tới hoặc bị file nào gọi tới. Toàn bộ script chạy từ root repo.

| File | Công dụng | Liên hệ với file/folder nào |
|---|---|---|
| `run-frontend.sh` | Boot FE active `frontend/` ở chế độ dev, cài dependency nếu thiếu rồi chạy `npm run dev` theo `$PORT` (mặc định 3000). | **Chạm `frontend/`** — dùng cho app active, thay cho `run-prototype.sh` khi test sản phẩm hiện tại. Pair được với `run-ngrok.sh`. |
| `run-backend.sh` | Boot backend local từ `mvp/code/`, dùng `uv run uvicorn app.main:app` theo `$PORT` (mặc định 8000). | **Chạm `mvp/code/`** — đọc env local/demo tuỳ cấu hình. Pair với `frontend/README.md` hoặc `run-frontend.sh` để chạy full stack. |
| `run-prototype.sh` | Boot Next.js dev server của `prototype/` (cd vào `prototype/`, `npm install` nếu chưa có `node_modules/`, rồi `npm run dev -p $PORT`, mặc định 3000). | **Chỉ chạm `prototype/`** — không liên quan `frontend/` (FE active có quy trình riêng theo `frontend/README.md`). Pair với `run-ngrok.sh` để expose. |
| `run-ngrok.sh` | Expose `http://localhost:$PORT` ra internet qua `ngrok http`. | **Cặp đôi với `run-frontend.sh` / `run-prototype.sh`** (cùng `$PORT`). Trong giai đoạn ngrok hand-off MVP cũng có thể trỏ vào FE active port 3000 hoặc backend port 8000 — tùy operator. Tham chiếu Phase 24 (BLOCKING ngrok cleared) trong [project_phase24_plus_roadmap]. |
| `backup-db.sh` | Hot-backup SQLite an toàn khi uvicorn đang serve qua `sqlite3 .backup`. Verify `PRAGMA integrity_check` rồi purge backup > `RETENTION_DAYS`. | **Đọc `mvp/code/data/screener.db`** (override qua `DB_PATH`). Ghi vào `BACKUP_DIR` (mặc định `./backups`). Documented trong **Phase 18 / Mốc 3 step 3** ([mvp/phases/phase-18-mvp-release-hardening/SUMMARY.md](mvp/phases/phase-18-mvp-release-hardening/SUMMARY.md)). Chạy qua cron trên server deploy template (xem `nginx.conf` + `docker-compose.yml`). |
| `restore-db.sh` | Phục hồi SQLite từ backup do `backup-db.sh` tạo. Refuse chạy nếu `pgrep uvicorn app.main:app` đang chạy; move file hiện tại sang `.pre-restore-<ts>` trước khi overwrite (kể cả `-wal`/`-shm` sidecar). | **Ghi vào `mvp/code/data/screener.db`** (override qua arg 2). Đầu vào là file output của `backup-db.sh`. Cũng documented trong **Phase 18 / Mốc 3 step 3**. |
| `cron-refresh.sh` | Login backend qua `POST /api/auth/login`, lấy JWT, gọi `POST /api/refresh/all`, poll `GET /api/refresh/{id}` đến terminal status. Schedule cron 09:30 UTC = 16:30 ICT. | **Gọi 3 endpoint thuộc `mvp/code/app/api/`**: `auth.py` (`/auth/login`), `refresh.py` (`POST /refresh/all` + `GET /refresh/{id}`). Service phía sau: `app/services/auth_service.py`, `app/services/refresh_service.py`. Documented trong **Phase 18 / Mốc 3 step 6** + TAD `g05` §3 refresh schedule. |
| `pre-handoff-refresh.sh` | Checklist DESTRUCTIVE trước khi ngrok hand-off: WIPE bảng `financial_reports` (data trộn unit pre-Phase-22) rồi chạy full `/refresh/all` trên `prod-screener.db` (~22 phút). Có prompt `[y/N]` xác nhận. | **Liên quan trực tiếp Phase 21 + 22** ([phase-21-financial-quality-no-downgrade](mvp/phases/phase-21-financial-quality-no-downgrade/), [phase-22-financial-unit-scaling](mvp/phases/phase-22-financial-unit-scaling/)) — script là deliverable của **Phase 25** ([phase-25-pre-handoff-ux-polish](mvp/phases/phase-25-pre-handoff-ux-polish/)). Đọc/ghi `mvp/code/data/prod-screener.db`. Gọi endpoint `auth.py` + `refresh.py` giống `cron-refresh.sh`. |
| `e2e-start-backend.sh` | Boot backend demo+stub cho Playwright E2E: `cd mvp/code`, set env `APP_ENV=demo`, `DB_PATH=./data/demo-screener.db`, `VNSTOCK_CLIENT_STUB=true`, `EXPORT_PDF_MODE=html_mock`, seed `demo-screener.db` nếu thiếu (`uv run python -m app.db.demo_seed`), exec `uv run uvicorn app.main:app`. | **Pair với `frontend/tests/e2e/`** + `frontend/playwright.config.ts`. Seed phụ thuộc `mvp/code/app/db/demo_seed.py`. Boot `mvp/code/app/main.py`. Là deliverable của **Phase 19** ([phase-19-playwright-smoke](mvp/phases/phase-19-playwright-smoke/)). |
| `nginx.conf` | Template nginx reverse proxy production (80 → 443 redirect + HSTS; 443 serve FE port 3000; 443 proxy `/api/*` + `/share/*` sang backend port 8000). | **Mount vào dịch vụ `nginx` của `docker-compose.yml`** (root repo). Proxy đến 2 service: `frontend` (Next.js) + `backend` (FastAPI `mvp/code/`). Pair với `docs/DEPLOY.md` cho operator (certbot, SSL). Là deliverable của **Phase 27** ([phase-27-deploy-polish](mvp/phases/phase-27-deploy-polish/)). |

### 5.8 Bảng dịch thuần tiếng Việt (đầy đủ từng file)

> Bản đọc nhanh, dùng từ phổ thông thay vì từ chuyên ngành. Liệt kê **đầy đủ từng file** song song với bảng kỹ thuật phía trên (§5.1-5.7). Tên tiếng Anh giữ nguyên vì là tên file thật, mô tả đã chuyển sang lời nói thường.

#### 5.8.1 Cấp ngoài cùng (`stock-v2/`)
| Tên | Là gì (nói nôm na) |
|---|---|
| `README.md` | Tờ giới thiệu của cả dự án. Đang đọc nó đây. |
| `docker-compose.yml` | Công thức dựng máy chủ thật khi muốn đưa lên mạng. Chưa dùng khi chạy ở máy mình. |
| `.gitignore` | Danh sách những thứ không gửi lên kho lưu trữ chung (file mật khẩu, cache build, file dữ liệu lớn…). |
| `docs/` | Kho tài liệu mô tả "sản phẩm phải làm gì" và "thiết kế ra sao". |
| `mvp/` | Phần ruột xử lý (máy chủ) đang dùng. |
| `frontend/` | Phần giao diện người dùng nhìn thấy trên trình duyệt. |
| `prototype/` | Bản dựng thử ban đầu, đã ĐÓNG BĂNG ngày 2026-05-08. Chỉ xem, không sửa. |
| `plan/` | Bảng kế hoạch tổng các giai đoạn xây dựng. |
| `prompts/` | Bộ câu lệnh dùng để chỉ AI dựng bản thử ngày xưa. Lưu làm tư liệu. |
| `report/` | Báo cáo tiếng Việt sau mỗi giai đoạn. |
| `script/` | Các đoạn lệnh bấm nút có sẵn (sao lưu, khôi phục, chạy, lên lịch, mở cổng). |
| `.claude/`, `.pytest_cache/`, `test-results/` | Dấu vết do công cụ/chạy kiểm thử tạo trên máy này. Không cần sửa tay. |

#### 5.8.2 Kho tài liệu (`docs/`)
| Tên | Là gì |
|---|---|
| `PRD_v0.5A_Final_Locked.md` | Tờ yêu cầu sản phẩm đã chốt. "Đây là cái cần làm." |
| `DEPLOY.md` | Hướng dẫn bê hệ thống ra máy chủ thật. |
| `design.md` | Ghi chú về cách bố trí giao diện và trải nghiệm. |
| `srs/` | Tả tính năng. |
| `tad/` | Tả kỹ thuật bên trong. |
| `system-architecture/` | Sơ đồ tổng kiến trúc. |

**`docs/srs/`** — mỗi file tả một tính năng:
| Tên | Tính năng nào |
|---|---|
| `00-srs-system-overview.md` | Tờ hướng dẫn đọc cuốn SRS. |
| `f01-core-screening-pipeline.md` | Cách hệ thống lọc cổ phiếu từ đầu đến cuối. |
| `f02-feature-engineering.md` | Cách tính 38 chỉ số dùng để chấm điểm cổ phiếu. |
| `f03-entry-point-logic.md` | Cách bắt thời điểm vào lệnh. |
| `f04-dashboard-market-overview.md` | Trang tổng quan thị trường. |
| `f05-price-board.md` | Bảng giá kiểu sàn chứng khoán (5 màu theo quy ước). |
| `f06-top-mua-explainability.md` | Danh sách "Top nên mua" kèm lý do tại sao. |
| `f07-red-flags-risk-warnings.md` | Các cảnh báo cờ đỏ (rủi ro). |
| `f08-stock-detail.md` | Trang chi tiết một mã cổ phiếu. |
| `f09-risk-management.md` | Các nút điều chỉnh khẩu vị rủi ro. |
| `f10-news-sentiment.md` | Tin tức + biểu đồ cảm xúc thị trường. |
| `f11-portfolio-lite.md` | Sổ ghi danh mục cổ phiếu đang giữ. |
| `f12-run-history-backtest.md` | Lịch sử các lần lọc + thử nghiệm chiến lược trên dữ liệu cũ. |
| `f13-export-share.md` | Xuất PDF + chia sẻ qua đường link. |
| `f14-telegram-bot.md` | Gửi kết quả qua Telegram. |
| `f15-settings.md` | Trang cài đặt. |
| `f16-authentication.md` | Đăng nhập một người dùng. |
| `f17-theme-i18n.md` | Đổi giao diện sáng/tối và đổi ngôn ngữ. |
| `g01-global-errors-and-validation.md` | Cách báo lỗi và kiểm tra đầu vào toàn hệ thống. |
| `g02-non-functional-requirements.md` | Yêu cầu về tốc độ + độ ổn định. |
| `g03-appendix-enums-constants.md` | Bảng tra cứu các giá trị cố định. |
| `g04-vibecoding-order.md` | Hướng dẫn thứ tự dựng khi cùng AI viết code. |

**`docs/tad/`** — mỗi file tả kỹ thuật một bộ phận:
| Tên | Bộ phận nào |
|---|---|
| `00-tad-system-overview.md` | Tờ hướng dẫn đọc cuốn TAD. |
| `c01-engines.md` | Bộ máy chấm điểm + dự đoán. |
| `c02-feature-engineering.md` | Cách tính 38 chỉ số. |
| `c03-entry-engine.md` | Bộ bắt điểm vào lệnh. |
| `c04-news-sentiment.md` | Phân tích cảm xúc tin tức. |
| `c05-dashboard.md` | Trang tổng quan thị trường. |
| `c06-pdf-share.md` | Xuất PDF + chia sẻ. |
| `c07-telegram.md` | Gửi Telegram. |
| `c08-auth.md` | Đăng nhập. |
| `c09-theme-i18n.md` | Giao diện sáng/tối + ngôn ngữ. |
| `c10-stock-detail-chart.md` | Biểu đồ giá trên trang chi tiết. |
| `g01-runtime.md` | Cách hệ thống chạy. |
| `g02-api.md` | Cách máy chủ tiếp khách. |
| `g03-database.md` | Cách lưu trữ dữ liệu. |
| `g04-cache.md` | Cách nhớ tạm cho nhanh. |
| `g05-cross-cutting.md` | Các quy ước chung xuyên hệ thống. |
| `g06-testing.md` | Cách kiểm thử. |
| `g07-deployment.md` | Cách triển khai lên máy thật. |
| `g08-coding-packages.md` | Các thư viện đã chọn dùng. |

**`docs/system-architecture/`** — sơ đồ kiến trúc:
| Tên | Là gì |
|---|---|
| `README.md` | Hướng dẫn thứ tự đọc các sơ đồ. |
| `01-system-context.md` | Hệ thống nằm ở đâu, ai dùng, kết nối gì. |
| `02-backend-layers.md` | Các lớp bên trong máy chủ. |
| `03-frontend-stack.md` | Các tầng bên trong giao diện. |
| `04-runtime-flows.md` | Dòng chảy lúc chạy: làm mới, lọc, xuất, chia sẻ. |
| `05-database-erd.md` | Sơ đồ các bảng dữ liệu. |
| `06-feature-pipeline.md` | Dây chuyền tính 38 chỉ số. |
| `07-cache-cross-cutting.md` | Tầng nhớ tạm + các quy ước chung. |

#### 5.8.3 Phần ruột xử lý (`mvp/`)

| Tên | Là gì |
|---|---|
| `mvp/README.md` | Bài hướng dẫn ngắn: muốn chạy máy chủ thì gõ những lệnh gì. |
| `mvp/code/` | Toàn bộ mã nguồn máy chủ. |
| `mvp/phases/` | Nhật ký xây dựng theo từng giai đoạn (phase 0 đến 28) + backlog nháp phase 29. |

**Bên trong `mvp/code/`**:
| Tên | Là gì |
|---|---|
| `Dockerfile` | Công thức đóng gói máy chủ thành "hộp" để mang đi nơi khác chạy. |
| `.dockerignore` | Danh sách thứ không nhét vào "hộp" khi build Docker. |
| `.gitignore` | Danh sách thứ riêng của backend không gửi lên kho chung. |
| `entrypoint.sh` | Lệnh khởi động khi "hộp" bật lên. |
| `pyproject.toml` | Danh sách thư viện máy chủ cần. |
| `uv.lock` | Chốt phiên bản chính xác của từng thư viện. |
| `alembic.ini` | Cấu hình cho công cụ đổi cấu trúc dữ liệu. |
| `alembic/` | Nhật ký các lần đổi cấu trúc dữ liệu (thêm bảng, sửa cột). |
| `.env.example` | Mẫu file cài đặt cho máy lập trình viên. |
| `.env` | File cài đặt đang dùng trên máy này (không gửi lên kho chung). |
| `env.demo.example` | Mẫu file cài đặt cho chạy demo. |
| `env.production.example` | Mẫu file cài đặt cho máy chủ thật. |
| `.env.telegram` | File mật chứa thông tin Telegram (không gửi lên kho chung). |
| `.python-version` | Ghi phiên bản Python phải dùng. |
| `data/screener.db` | File dữ liệu chính (dữ liệu thật, có DEV). |
| `data/demo-screener.db` | File dữ liệu giả để chạy demo. |
| `data/prod-screener.db` | File dữ liệu thật phục vụ người dùng cuối. |
| `data/test-screener.db` | File dữ liệu dùng cho kiểm thử. |
| `data/sample-export.pdf` | File PDF mẫu xuất thử. |
| `data/*.db-shm` + `*.db-wal` | File phụ của SQLite (không xoá tay). |
| `app/` | Trái tim của máy chủ (chi tiết bên dưới). |
| `tests/` | Bộ bài kiểm tra tự động (chi tiết bên dưới). |

**`mvp/code/app/` — file gốc**:
| Tên | Là gì |
|---|---|
| `main.py` | Cánh cổng vào máy chủ. Bật máy chủ là chạy file này đầu tiên. |
| `config.py` | Đọc các giá trị cài đặt từ file môi trường (mật khẩu, đường dẫn DB…). |
| `dependencies.py` | Bộ "phụ kiện" gắn vào mỗi yêu cầu: kết nối DB, người đang đăng nhập… |
| `job_lock.py` | Cái khoá chống chạy trùng việc (cùng lúc 2 lần lọc cùng một loại). |

**`mvp/code/app/api/` — Quầy tiếp nhận yêu cầu** (mỗi file một loại):
| Tên | Tiếp khách loại nào |
|---|---|
| `auth.py` | Đăng nhập, đổi token. |
| `backtest.py` | Chạy thử chiến lược trên dữ liệu cũ. |
| `export.py` | Yêu cầu xuất PDF. |
| `health.py` | Hỏi "máy chủ còn sống không". |
| `news.py` | Lấy tin tức + cảm xúc. |
| `portfolio.py` | Thêm/sửa/xoá danh mục cổ phiếu đang giữ. |
| `refresh.py` | Yêu cầu làm mới dữ liệu. |
| `results.py` | Lấy kết quả lần lọc gần nhất. |
| `screening.py` | Bấm lọc cổ phiếu. |
| `settings.py` | Đọc/đổi cài đặt cá nhân. |
| `share.py` | Tạo link chia sẻ công khai. |
| `stocks.py` | Lấy chi tiết một mã cổ phiếu. |
| `telegram.py` | Bấm gửi Telegram. |

**`mvp/code/app/constants/` — Bảng tra cứu cố định**:
| Tên | Bảng tra cứu gì |
|---|---|
| `enums.py` | Các nhóm trạng thái (đang chạy / xong / lỗi…). |
| `error_codes.py` | Danh sách mã lỗi + ý nghĩa. |
| `features.py` | Danh sách 38 chỉ số tính được. |
| `reason_codes.py` | Danh sách lý do "vì sao nên mua". |
| `sources.py` | Danh sách 5 nguồn tin tức. |
| `thresholds.py` | Các ngưỡng số cố định (chấm điểm, mức cảnh báo). |

**`mvp/code/app/core/` — Đồ dùng chung của máy chủ**:
| Tên | Là gì |
|---|---|
| `envelope.py` | Khuôn chuẩn để máy chủ trả kết quả về (luôn có "dữ liệu" hoặc "lỗi"). |
| `errors.py` | Tự định nghĩa các loại lỗi + cách trả lỗi cho người dùng. |
| `jwt.py` | Đóng dấu "vé thông hành" sau khi đăng nhập. |
| `password.py` | Mã hoá + kiểm tra mật khẩu. |

**`mvp/code/app/crawlers/` — Người đi gom dữ liệu bên ngoài**:
| Tên | Đi gom gì |
|---|---|
| `vnstock_client.py` | Lấy giá + báo cáo tài chính từ vnstock (có dự phòng KBS nếu VCI hỏng). |
| `news_sources.py` | Danh sách nguồn tin/RSS mà hệ thống biết cách đọc. |
| `news_rss.py` | Người đọc RSS để gom tin thật. |
| `macro_crawler.py` | Người gom số liệu vĩ mô thật; nếu nguồn ngoài hỏng thì dữ liệu seed vẫn là nền dự phòng. |
| `cache_manager.py` | Nhớ tạm để không phải gọi đi gọi lại; có dữ liệu giả khi nguồn hỏng. |

**`mvp/code/app/db/` — Đồ nghề kết nối với cơ sở dữ liệu**:
| Tên | Là gì |
|---|---|
| `session.py` | Mở kết nối tới SQLite. |
| `pragmas.py` | Bật các chế độ đặc biệt của SQLite (chống mất dữ liệu khi sập máy…). |
| `seed.py` | Đổ dữ liệu mẫu vào DB thật. |
| `demo_seed.py` | Đổ dữ liệu mẫu vào DB demo (chạy ở máy lập trình viên). |

**`mvp/code/app/engines/` — Bộ máy phân tích**:
| Tên | Là gì |
|---|---|
| `base.py` | Bản khuôn chung cho mọi bộ máy (để dễ thay sau này). |
| `scoring_baseline.py` | Bộ chấm điểm phiên bản đầu (đang dùng). |
| `scoring_xgboost.py` | Bộ chấm điểm phiên bản nâng cao (để dành, chưa bật). |
| `price_baseline.py` | Bộ dự đoán giá phiên bản đầu. |
| `price_lstm.py` | Bộ dự đoán giá bằng AI (để dành, chưa bật). |
| `entry_engine.py` | Bộ bắt thời điểm vào lệnh. |

**`mvp/code/app/models/` — Bản vẽ các bảng dữ liệu** (mỗi file một nhóm bảng):
| Tên | Bảng nào |
|---|---|
| `user.py` | Người dùng (chỉ có một). |
| `stock.py` | Danh sách mã cổ phiếu + ngành. |
| `financial.py` | Báo cáo tài chính theo quý + năm. |
| `macro.py` | Số liệu vĩ mô. |
| `news.py` | Tin tức + điểm cảm xúc. |
| `portfolio.py` | Danh mục cổ phiếu đang giữ. |
| `run.py` | Mỗi lần bấm lọc lưu một dòng. |
| `backtest.py` | Mỗi lần chạy thử chiến lược lưu một dòng. |
| `share.py` | Các link chia sẻ công khai. |
| `settings.py` | Cài đặt cá nhân. |
| `cache.py` | Bảng nhớ tạm. |

**`mvp/code/app/repositories/` — Người thủ kho** (mỗi file phụ trách một bảng):
| Tên | Thủ kho cho bảng nào |
|---|---|
| `user_repo.py` | Bảng người dùng. |
| `stock_repo.py` | Bảng cổ phiếu. |
| `financial_repo.py` | Bảng báo cáo tài chính (có quy tắc "không ghi đè bằng dữ liệu xấu hơn"). |
| `macro_repo.py` | Bảng vĩ mô. |
| `news_repo.py` | Bảng tin tức. |
| `portfolio_repo.py` | Bảng danh mục. |
| `price_repo.py` | Bảng giá. |
| `results_repo.py` | Bảng kết quả lọc. |
| `screening_repo.py` | Bảng các lần bấm lọc. |
| `backtest_repo.py` | Bảng các lần chạy thử chiến lược. |
| `share_repo.py` | Bảng link chia sẻ. |
| `settings_repo.py` | Bảng cài đặt. |
| `cache_repo.py` | Bảng nhớ tạm. |
| `excluded_repo.py` | Bảng các mã bị loại khỏi danh sách lọc. |

**`mvp/code/app/schemas/` — Bản mô tả "yêu cầu vào" và "trả về"**:
| Tên | Mô tả cho phần nào |
|---|---|
| `auth.py` | Đăng nhập. |
| `backtest.py` | Chạy thử chiến lược. |
| `compare.py` | So sánh các lần lọc. |
| `envelope.py` | Khuôn chung cho mọi câu trả lời. |
| `news.py` | Tin tức. |
| `portfolio.py` | Danh mục. |
| `refresh.py` | Làm mới dữ liệu. |
| `result.py` | Kết quả lọc. |
| `run.py` | Mỗi lần lọc. |
| `settings.py` | Cài đặt. |
| `share.py` | Link chia sẻ. |
| `stock.py` | Chi tiết cổ phiếu. |
| `telegram.py` | Gửi Telegram. |

**`mvp/code/app/services/` — Bộ não xử lý** (mỗi file một việc):
| Tên | Lo việc gì |
|---|---|
| `auth_service.py` | Cấp vé đăng nhập. |
| `backtest_service.py` | Điều phối chạy thử chiến lược và chấm đúng/sai theo PRD §4.5. |
| `compare_service.py` | Tính bảng so sánh giữa các lần lọc. |
| `dashboard_service.py` | Gom số liệu để dựng trang tổng quan. |
| `export_service.py` | In ra PDF. |
| `feature_service.py` | Tính 38 chỉ số cho mỗi mã. |
| `filter_service.py` | Áp các bộ lọc lên danh sách cổ phiếu. |
| `sentiment_rule.py` | Chấm cảm xúc tin tức bằng luật đơn giản. |
| `news_service.py` | Lấy tin + cộng dồn cảm xúc. |
| `news_crawl_service.py` | Điều phối việc đi gom tin rồi lưu lại. |
| `portfolio_service.py` | Quản lý danh mục + tính giá trị. |
| `refresh_service.py` | Điều phối việc đi gom dữ liệu mới: giá, báo cáo tài chính và vĩ mô. |
| `results_service.py` | Trả kết quả lọc cho giao diện. |
| `risk_service.py` | Bật các cờ cảnh báo rủi ro. |
| `screening_service.py` | Điều phối một lần bấm lọc đầy đủ. |
| `settings_service.py` | Kiểm tra cài đặt có hợp lệ không trước khi lưu. |
| `share_service.py` | Tạo + đọc link chia sẻ công khai. |
| `stock_service.py` | Ghép tất cả thông tin của một mã cho trang chi tiết. |
| `telegram_service.py` | Gửi tin nhắn Telegram (có thử lại nếu bị nghẽn). |

**`mvp/code/tests/` — Bộ kiểm tra tự động**:
| Tên | Là gì |
|---|---|
| `conftest.py` | Đồ dùng chung cho toàn bộ bài kiểm tra. |
| `fixtures/anchor_features.py` | Dữ liệu mẫu cho bộ bắt điểm vào. |
| `fixtures/kbs_snapshot.py` | Dữ liệu mẫu của nguồn KBS. |

`tests/unit/` — kiểm tra từng món nhỏ:
| Tên | Kiểm tra gì |
|---|---|
| `conftest.py` | Đồ dùng chung của nhóm này. |
| `test_cache_manager.py` | Bộ nhớ tạm. |
| `test_config_env_chain.py` | Việc đọc file môi trường nối tiếp. |
| `test_entry.py` | Bộ bắt điểm vào. |
| `test_feature_sanity.py` | Sự hợp lý của các chỉ số. |
| `test_features.py` | Cách tính 38 chỉ số. |
| `test_filters.py` | Các bộ lọc. |
| `test_job_lock.py` | Cái khoá chống chạy trùng. |
| `test_kbs_snapshot.py` | Dữ liệu mẫu KBS. |
| `test_main_prod_guard.py` | Lá chắn không cho boot sai môi trường. |
| `test_models.py` | Bản vẽ các bảng. |
| `test_risk.py` | Các quy tắc cờ đỏ. |
| `test_scoring.py` | Bộ chấm điểm. |
| `test_telegram_broadcast.py` | Phần gửi Telegram. |
| `test_vnstock_client.py` | Người đi gom dữ liệu vnstock. |

`tests/integration/` — kiểm tra giả lập như có người dùng thật:
| Tên | Kiểm tra gì |
|---|---|
| `conftest.py` | Đồ dùng chung của nhóm này. |
| `test_auth.py` | Luồng đăng nhập. |
| `test_backtest.py` | Luồng chạy thử chiến lược. |
| `test_compare.py` | Luồng so sánh các lần lọc. |
| `test_dashboard.py` | Trang tổng quan. |
| `test_db_isolation.py` | Đảm bảo bài kiểm tra không đụng vào DB thật. |
| `test_export.py` | Xuất PDF. |
| `test_financial_repo.py` | Kho báo cáo tài chính. |
| `test_health.py` | Câu hỏi "còn sống không". |
| `test_news.py` | Tin tức. |
| `test_portfolio.py` | Danh mục. |
| `test_pragmas.py` | Các chế độ SQLite. |
| `test_refresh.py` | Việc làm mới dữ liệu. |
| `test_results.py` | Đọc kết quả lọc. |
| `test_run_lifecycle.py` | Vòng đời một lần lọc (bắt đầu → xong). |
| `test_run_telegram_broadcast.py` | Gửi Telegram sau khi lọc. |
| `test_seed.py` | Việc đổ dữ liệu mẫu. |
| `test_settings.py` | Cài đặt. |
| `test_share.py` | Link chia sẻ. |
| `test_stocks.py` | Chi tiết cổ phiếu. |
| `test_telegram.py` | Phần Telegram nói chung. |

#### 5.8.4 Nhật ký giai đoạn (`mvp/phases/`)

Mỗi thư mục `phase-N-…/` chứa 2 tờ:
- `SUMMARY.md` — kể giai đoạn đó đã làm gì.
- `REVIEW.md` — tự nhìn lại xem còn sót gì không.

**Liên hệ với `mvp/code/`:** `mvp/code/` cho biết **hiện tại** máy chủ trông thế nào; `mvp/phases/` cho biết **vì sao** nó thành ra như vậy theo dòng thời gian.

| Giai đoạn | Đã làm gì (nói nôm na) |
|---|---|
| `phase-0-bootstrap/` | Dựng khung trống ban đầu. |
| `phase-1-db-constants-seed/` | Vẽ bảng dữ liệu + đổ dữ liệu mẫu. |
| `phase-2-auth-settings/` | Thêm đăng nhập + cài đặt. |
| `phase-3-refresh-layer/` | Thêm chức năng làm mới dữ liệu. |
| `phase-4-engines-features-risk/` | Thêm bộ chấm điểm + tính chỉ số + cờ rủi ro. |
| `phase-5-screening-orchestrator/` | Ghép tất cả lại thành luồng "bấm lọc". |
| `phase-6-read-apis/` | Thêm các quầy đọc dữ liệu cho giao diện. |
| `phase-7-personal-history/` | Thêm danh mục cá nhân + lịch sử lọc. |
| `phase-8-backtest-export-share-telegram/` | Thêm 4 việc: chạy thử chiến lược + xuất PDF + chia sẻ + Telegram. |
| `phase-9-fe-swap/` | Cắm giao diện sang máy chủ thật (trước đó dùng dữ liệu giả). |
| `phase-10-integration-qa/` | Dò + sửa lỗi sau khi ghép giao diện vào. |
| `phase-11-readme/` | Viết tài liệu hướng dẫn. |
| `phase-12-production-data-qa/` | Kiểm chất lượng dữ liệu thật. |
| `phase-13-demo-stability/` | Làm bản demo chạy ổn định. |
| `phase-14-production-data-hardening/` | Gia cố phần lấy giá dữ liệu thật. |
| `phase-15-financial-ingestion/` | Bắt đầu nạp báo cáo tài chính. |
| `phase-16-mvp-data-readiness-closure/` | Hoàn thiện việc chuẩn bị dữ liệu cho bản chính thức. |
| `phase-17-financial-source-fallback/` | Thêm nguồn dự phòng KBS khi VCI hỏng. |
| `phase-18-mvp-release-hardening/` | Gia cố trước khi phát hành. |
| `phase-19-playwright-smoke/` | Thêm bài kiểm tra tự động bấm vào giao diện. |
| `phase-20-telegram-real-send-verify/` | Kiểm tra gửi Telegram thật. |
| `phase-21-financial-quality-no-downgrade/` | Đặt quy tắc "không ghi đè bằng dữ liệu xấu hơn". |
| `phase-22-financial-unit-scaling/` | Đồng nhất đơn vị số trong báo cáo tài chính + thêm lá chắn môi trường. |
| `phase-23-telegram-broadcast-config-env/` | Hoàn thiện việc gửi Telegram sau mỗi lần lọc. |
| `phase-24-fe-next16-security-upgrade/` | Nâng cấp giao diện lên Next 16 (vá lỗ hổng bảo mật). |
| `phase-25-pre-handoff-ux-polish/` | Đánh bóng giao diện + chuẩn bị bàn giao. |
| `phase-26-kbs-data-polish/` | Làm sạch dữ liệu từ nguồn KBS. |
| `phase-27-deploy-polish/` | Soạn bộ công cụ triển khai (docker, nginx, hướng dẫn). |
| `phase-28-polish-batch/` | Đánh bóng nhiều thứ nhỏ một lượt. |
| `phase-29-DRAFT-backlog/` | Danh sách việc nháp sau bàn giao. Chưa phải giai đoạn đã đóng. |

#### 5.8.5 Giao diện người dùng (`frontend/`)

| Tên | Là gì |
|---|---|
| `README.md` | Bài hướng dẫn chạy giao diện. |
| `package.json` | Danh sách phần mềm giao diện cần + lệnh `npm run dev/build` chạy Next 16 Turbopack mặc định. |
| `package-lock.json` | Chốt phiên bản chính xác. |
| `next.config.js` | Cấu hình Next.js (hiện tối giản, không còn webpack alias/pin). |
| `tsconfig.json` | Cấu hình TypeScript (ngôn ngữ viết). |
| `tsconfig.tsbuildinfo` | Cache giúp build nhanh hơn. |
| `tailwind.config.ts` | Cấu hình bộ quy tắc trang trí Tailwind. |
| `postcss.config.js` | Cấu hình kèm theo Tailwind. |
| `playwright.config.ts` | Cấu hình bộ kiểm tra tự động bấm giao diện. |
| `.eslintrc.json` | Quy tắc bắt lỗi khi viết. |
| `next-env.d.ts` | File phụ trợ của Next.js (không sửa tay). |
| `.env.local` | File cài đặt riêng cho máy lập trình viên. |
| `public/mockServiceWorker.js` | File phụ trợ cho dữ liệu giả. |
| `tests/e2e/` | Bài kiểm tra tự động bấm vào giao diện như người dùng thật. |
| `.next/` | Kết quả build local của Next.js. Không sửa tay. |
| `node_modules/` | Thư viện đã cài trên máy. Không sửa tay. |
| `playwright-report/` | Báo cáo sau khi chạy kiểm thử giao diện. Không sửa tay. |
| `test-results/` | Dữ liệu thô sau khi chạy Playwright. Không sửa tay. |
| `src/` | Toàn bộ mã giao diện (chi tiết dưới). |

**`frontend/src/`**:
| Tên | Là gì |
|---|---|
| `app/(app)/` | Các trang phải đăng nhập mới vào được. |
| `app/(auth)/` | Trang đăng nhập. |
| `app/share/` | Trang xem link chia sẻ công khai (không cần đăng nhập). |
| `app/layout.tsx` | Khung chung bao quanh mọi trang. |
| `app/icon.tsx` + `app/apple-icon.tsx` | Biểu tượng hiển thị trên tab trình duyệt + màn hình iPhone. |
| `components/auth/` | Các viên gạch giao diện cho phần đăng nhập. |
| `components/backtest/` | Các viên gạch cho phần chạy thử chiến lược. |
| `components/badges/` | Các nhãn nhỏ (kiểu "MUA / BÁN / GIỮ"). |
| `components/charts/` | Các biểu đồ. |
| `components/charts/ResponsiveChart.tsx` | Vỏ bọc giúp biểu đồ co giãn ổn định theo màn hình. |
| `components/common/` | Các viên gạch dùng chung khắp nơi. |
| `components/common/InfoBanner.tsx` | Thanh thông báo đầu app, có ghi nhớ trạng thái đã đóng. |
| `components/dashboard/` | Các viên gạch cho trang tổng quan. |
| `components/export/` | Các viên gạch cho phần xuất PDF. |
| `components/layout/` | Khung bố cục (đầu trang, sườn, chân trang). |
| `components/news/` | Các viên gạch cho phần tin tức. |
| `components/portfolio/` | Các viên gạch cho danh mục. |
| `components/price-board/` | Các viên gạch cho bảng giá. |
| `components/run/` | Các viên gạch cho phần bấm lọc. |
| `components/run-history/` | Các viên gạch cho lịch sử lọc. |
| `components/settings/` | Các viên gạch cho trang cài đặt. |
| `components/share/` | Các viên gạch cho phần chia sẻ link. |
| `components/stock-detail/` | Các viên gạch cho trang chi tiết cổ phiếu. |
| `components/tables/` | Các kiểu bảng dùng chung. |
| `components/telegram/` | Các viên gạch cho phần Telegram. |
| `contexts/AuthContext.tsx` | Bộ nhớ chung: ai đang đăng nhập. |
| `contexts/LocaleContext.tsx` | Bộ nhớ chung: ngôn ngữ đang dùng. |
| `contexts/MockOutcomeContext.tsx` | Bộ nhớ chung: lựa chọn kết quả giả khi chạy demo. |
| `contexts/RunContext.tsx` | Bộ nhớ chung: lần lọc đang xem. |
| `contexts/ThemeContext.tsx` | Bộ nhớ chung: giao diện sáng/tối. |
| `contexts/ToastContext.tsx` | Bộ nhớ chung: các thông báo bóng nổi lên. |
| `lib/api.ts` | Bộ hàm gọi máy chủ. |
| `lib/types.ts` | Khai báo kiểu dữ liệu (giống bảng bên máy chủ). |
| `lib/constants.ts` | Các giá trị cố định. |
| `lib/hooks/` | Các "móc nối" tiện dụng (vd. móc xuất PDF). |
| `messages/en.json` | Từ điển tiếng Anh. |
| `messages/vi.json` | Từ điển tiếng Việt. |
| `mocks/handlers.ts` | Bộ tiếp khách giả (giả vờ là máy chủ). |
| `mocks/data/` | Dữ liệu giả (vd. bảng giá mẫu). |
| `styles/globals.css` | Quy tắc trang trí toàn cục. |
| `styles/themes.css` | Quy tắc màu cho giao diện sáng/tối. |

#### 5.8.6 Bản dựng thử đóng băng (`prototype/`)

Bố cục giống `frontend/`. **Không sửa.** Chỉ xem lại để tham khảo cách làm cũ. Đã đóng băng từ 2026-05-08.

#### 5.8.7 Các thư mục phụ (`plan/`, `prompts/`, `report/`)

**`plan/`**:
| Tên | Là gì |
|---|---|
| `PLAN.md` | Bản kế hoạch đến Phase 29+. Đọc để biết "đã xong gì, còn gì". |

**`prompts/`** — câu lệnh AI cũ:
| Tên | Là gì |
|---|---|
| `cluster-1-shell-foundation.md` | Lệnh dựng khung giao diện ban đầu. |
| `cluster-2-screening-flow.md` | Lệnh dựng luồng bấm lọc. |
| `cluster-3-stock-detail.md` | Lệnh dựng trang chi tiết cổ phiếu. |
| `cluster-4-market-browse.md` | Lệnh dựng phần xem thị trường + bảng giá + tin tức. |
| `cluster-5-personal-history.md` | Lệnh dựng danh mục + lịch sử lọc + chạy thử chiến lược. |
| `cluster-6-export-integrations.md` | Lệnh dựng xuất PDF + chia sẻ + Telegram. |

**`report/`** — báo cáo cho người dùng đọc:
| Tên | Là gì |
|---|---|
| `README.md` | Mục lục các báo cáo. |
| `cluster-prompts/cluster-1-summary.md` | Tóm tắt sau khi dựng xong cụm 1 (khung giao diện). |
| `cluster-prompts/cluster-2-summary.md` | Tóm tắt sau khi dựng xong cụm 2 (luồng lọc). |
| `cluster-prompts/cluster-3-summary.md` | Tóm tắt sau khi dựng xong cụm 3 (trang chi tiết). |
| `cluster-prompts/cluster-4-summary.md` | Tóm tắt sau khi dựng xong cụm 4 (xem thị trường). |
| `cluster-prompts/cluster-5-summary.md` | Tóm tắt sau khi dựng xong cụm 5 (danh mục + lịch sử). |
| `cluster-prompts/cluster-6-summary.md` | Tóm tắt sau khi dựng xong cụm 6 (xuất + chia sẻ + Telegram). |
| `mvp-build/SUMMARY.md` | Sổ tổng việc còn nợ + các lỗi từng phát hiện trong quá trình dựng. |
| `phase-mvp/phase-N-…/` | Mỗi thư mục là một bản báo cáo tiếng Việt sau một giai đoạn (tương ứng với `mvp/phases/`, nhưng viết cho người không lập trình đọc). Có đủ phase 1 đến 28. |

#### 5.8.8 Bộ lệnh bấm nút (`script/`)

| Tên | Bấm nút này thì máy làm gì |
|---|---|
| `run-frontend.sh` | Bật giao diện chính (`frontend/`) lên xem ở máy mình. |
| `run-backend.sh` | Bật máy chủ chính (`mvp/code/`) lên ở máy mình. |
| `run-prototype.sh` | Bật bản dựng thử (`prototype/`) lên xem ở máy mình. |
| `run-ngrok.sh` | Mở "đường hầm" cho người khác trên mạng vào máy mình xem được. Hay đi đôi với `run-frontend.sh` hoặc `run-prototype.sh`. |
| `backup-db.sh` | Sao lưu file dữ liệu chính (`screener.db`) sang chỗ an toàn. Có thể chạy lúc máy chủ đang phục vụ, không sao. |
| `restore-db.sh` | Phục hồi dữ liệu từ bản sao lưu. Bắt buộc phải tắt máy chủ trước khi chạy. |
| `cron-refresh.sh` | Đăng nhập máy chủ rồi bấm nút "làm mới dữ liệu" hàng ngày lúc 16:30 giờ Việt Nam. |
| `pre-handoff-refresh.sh` | Lệnh DỌN dữ liệu cũ + làm mới sạch trước khi bàn giao cho người dùng — chạy mất khoảng 22 phút, có hỏi xác nhận trước. |
| `e2e-start-backend.sh` | Bật máy chủ ở chế độ "demo + dữ liệu giả" để bài kiểm tra giao diện tự động chạy được. |
| `nginx.conf` | Bản cấu hình "người gác cổng" cho lúc lên máy chủ thật: nhận khách HTTPS rồi chuyển vào đúng nơi. |

#### 5.8.9 Công thức dựng máy chủ thật (`docker-compose.yml`)

File `docker-compose.yml` ở cấp ngoài cùng repo. Coi nó như "công thức nấu ăn" mô tả cần bật những "hộp máy" (container) nào, mỗi hộp dùng nguyên liệu gì, nối với nhau ra sao. Chỉ dùng khi bê hệ thống lên máy chủ thật — không dùng khi chạy ở máy lập trình viên.

Bên trong file định nghĩa **3 hộp máy** + **1 ngăn lưu trữ**:

| Phần | Là gì (nói nôm na) |
|---|---|
| Hộp `backend` | Hộp chạy máy chủ (FastAPI). Đóng từ thư mục `mvp/code/` qua file `Dockerfile`. Đọc cấu hình từ `mvp/code/.env.production` (file mật, không gửi lên kho chung). Tự kiểm tra "còn sống không" mỗi 30 giây. Chỉ mở cổng 8000 cho máy chủ tự gọi nội bộ (không cho người ngoài vào thẳng). |
| Hộp `frontend` | Hộp chạy giao diện (Next.js phiên bản production). Dùng image `node:20-alpine`, gắn thẳng thư mục `frontend/` vào, chạy `npm install` + `npm start`. Chờ hộp `backend` khoẻ rồi mới khởi động. Mở cổng 3000 nội bộ. |
| Hộp `nginx` | Hộp "người gác cổng" (nginx). Nhận khách HTTPS ngoài internet ở cổng 80 + 443, chuyển vào đúng hộp bên trong. Lấy cấu hình từ `script/nginx.conf` và chứng chỉ SSL từ `script/ssl/`. |
| Ngăn `prod-data` | Ngăn lưu trữ riêng giữ file `prod-screener.db` (dữ liệu thật). Tách rời khỏi hộp `backend` để khi nâng cấp hộp, dữ liệu vẫn còn nguyên. |

Các bước người vận hành (operator) làm theo công thức này:
1. Tải code về máy chủ thật.
2. Sao file mẫu `mvp/code/env.production.example` → `mvp/code/.env.production`, rồi điền các giá trị mật (JWT_SECRET, mật khẩu đăng nhập, token Telegram…). KHÔNG gửi file này lên kho chung.
3. Vào thư mục `frontend/` chạy `npm install` + `npm run build` (chỉ làm một lần đầu).
4. Gõ `docker compose up -d` để bật cả 3 hộp.
5. Đổ dữ liệu mẫu lần đầu: `docker compose exec backend python -m app.db.seed`.
6. (Tuỳ chọn) đặt lịch chạy `script/cron-refresh.sh` hàng ngày 16:30 giờ Việt Nam.

**Lưu ý:** Đây mới là khuôn baseline, **chưa sẵn sàng** dùng trực tiếp cho khách thật — phải tự xin chứng chỉ HTTPS (Let's Encrypt qua certbot), gắn két sắt mật khẩu (1Password / vault), và đặt tường lửa.

---

## 6. License & author

- **Author:** Ngô Minh Tú (Business-Analyst: Claude AI-OpenAI Codex)
- **License:** Private — chưa cấp phép phân phối công khai.
- **Disclaimer:** Tool hỗ trợ phân tích, KHÔNG phải khuyến nghị đầu tư. Người dùng tự chịu trách nhiệm quyết định.

---

*Cập nhật 2026-05-24 (Phase 28 đóng + post-Phase deferral closure: macro crawler real-source best-effort, backtest strict PRD §4.5, Turbopack migration). 311 BE tests baseline · latest targeted backend regression 55/55 · FE Next 16.2.6 Turbopack build 14 routes · Playwright 8/8 · docker-compose + nginx + DEPLOY.md template.*
