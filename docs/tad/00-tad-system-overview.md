---
id: 00
title: TAD System Overview — Architecture, Tech Stack, Project Structure
type: overview
version: v1.2 — LOCKED (post-prototype reconciliation)
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§1-3, §28); cluster 1 reconciliation 2026-05-09
---

# TECHNICAL ARCHITECTURE DOCUMENT (TAD) — System Overview
# VN REAL ESTATE AI SCREENER

> *Dữ liệu dẫn đường, quyết định thuộc về bạn*

**Version 1.1 — Hardened for Vibecoding**
**Based on:** PRD v0.5A + SRS v1.0 + TAD v1.0 + 3rd-party review
**Author:** Ngô Minh Tú | **BA (Business Analyst):** Claude AI

| Field | Details |
|---|---|
| TAD Version | 1.1 — Hardened |
| Changes from v1.0 | 8 must-fixes + 4 should-fixes from 3rd-party review |
| Document Flow | PRD v0.5A ✅ → SRS v1.2 ✅ → **TAD v1.2 (this)** ✅ → Vibecoding Plan |
| Status | **LOCKED for coding** |

---

## Revision History

| Version | Date | Changes |
|---|---|---|
| v1.0 | 04/05 | Initial TAD |
| v1.1 | 04/05 | 8 must-fixes + 4 should-fixes from 1st review. Then 2 must-fixes + 5 should-fixes from 2nd review merged in-place: single heavy job lock, SQLite WAL, source-level cache wording, /health + /version, run_error field, repositories/ dir, timeout env vars. Final patches: architecture diagram job lock wording + in-memory refresh job status storage + SQLite busy_timeout. **LOCKED.** |
| v1.2 | 2026-05-09 | Post-prototype reconciliation từ cluster 1 (Shell & Foundation). §2 Frontend tech stack: ➕ Lucide React (icons), ➕ MSW (dev mocks). §3 Project structure: ❌ REMOVED `lib/formatters.ts` (không tồn tại trong prototype), ❌ REMOVED `i18n/` path → ✅ REPLACED bằng `messages/` (next-intl convention prototype dùng), ➕ ADDED `contexts/`, `mocks/`, app route groups, components subdirs theo cluster. c08, c09, g02, g05 cập nhật pattern frontend (apiFetch, ProtectedRoute, anti-flash boot, provider stack, MSW catch-all). Patch v3 (cùng ngày): bump §1 Document Flow + footer + Change Log heading khỏi `v1.1`, c09 §2 path còn sót `i18n/`, g02 §3 health/version response trả version cũ, g03 §L position out-of-order, f17 AC-17-04 incomplete (thiếu Settings page replication), f15 schema thiếu `settings_version` + `updated_at`. **LOCKED.** |

---

## Index — Global (g*)

Cross-cutting, system-wide modules.

- [g01-runtime.md](g01-runtime.md) — Two-Flow Architecture (Refresh vs Screening) + Run State Machine + Sequence Diagrams
- [g02-api.md](g02-api.md) — API Design (full endpoint registry, pagination, health/version, key responses)
- [g03-database.md](g03-database.md) — Database Schema (16 tables)
- [g04-cache.md](g04-cache.md) — Cache Architecture (source-level TTL, staleness, vnstock rate limit)
- [g05-cross-cutting.md](g05-cross-cutting.md) — Concurrency Control (job lock) + Logging + Error Response Standard
- [g06-testing.md](g06-testing.md) — Testing Strategy & Fixtures
- [g07-deployment.md](g07-deployment.md) — Deployment & Environment + Migration Plan + Security
- [g08-coding-packages.md](g08-coding-packages.md) — Vibecoding Packages 0–10

## Index — Component (c*)

Module-specific designs. Each component file points to its implementing SRS file (`Implements:`) and the global modules it depends on (`Related — global:`).

- [c01-engines.md](c01-engines.md) — Engine Interfaces (Scoring, Price, Entry, Risk)
- [c02-feature-engineering.md](c02-feature-engineering.md) — Feature Engineering Service + Normalization Spec (38 features)
- [c03-entry-engine.md](c03-entry-engine.md) — Entry Point Engine (deterministic, priority order)
- [c04-news-sentiment.md](c04-news-sentiment.md) — News & Sentiment Pipeline
- [c05-dashboard.md](c05-dashboard.md) — Dashboard Aggregate
- [c06-pdf-share.md](c06-pdf-share.md) — PDF Export & Share Link
- [c07-telegram.md](c07-telegram.md) — Telegram Integration
- [c08-auth.md](c08-auth.md) — Auth & Session
- [c09-theme-i18n.md](c09-theme-i18n.md) — Theme & i18n Architecture

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14+)                     │
│  Login │ Dashboard │ PriceBoard │ TopMUA │ Detail │ Settings │
│                          │ REST API                           │
└──────────────────────────┼────────────────────────────────────┘
                           │
┌──────────────────────────┼────────────────────────────────────┐
│                    BACKEND (FastAPI)                           │
│                          │                                     │
│   ┌──────────────────────┴──────────────────────────┐        │
│   │                 API Router Layer                  │        │
│   └──────────────────────┬──────────────────────────┘        │
│                          │                                     │
│   ┌──────────┐  ┌───────┴────────┐  ┌──────────────┐        │
│   │ Refresh  │  │  Screening     │  │ Query/CRUD   │        │
│   │ Service  │  │  Orchestrator  │  │ Services     │        │
│   └────┬─────┘  └───────┬────────┘  └──────┬───────┘        │
│        │                │                    │                 │
│   ┌────┴────────────────┴────────────────────┴────┐          │
│   │              Data Layer (SQLAlchemy)            │          │
│   │         SQLite + Cache Manager                  │          │
│   └─────────────────────┬─────────────────────────┘          │
│                         │                                     │
│   ┌──────────┐  ┌──────┴─────┐  ┌────────────────┐          │
│   │ Scoring  │  │   Price    │  │  Entry Point   │          │
│   │ Engine   │  │   Engine   │  │  Engine        │          │
│   │(Baseline/│  │(Baseline/  │  │(Deterministic) │          │
│   │ XGBoost) │  │ LSTM)      │  │                │          │
│   └──────────┘  └────────────┘  └────────────────┘          │
│                                                               │
│   ┌───── JOB LOCK: max 1 heavy job at a time ────────┐      │
│   └──────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────┘
         │
    ┌────┴────┐
    │ SQLite  │ (16 tables)
    └─────────┘
         │
    External: vnstock │ 5 news RSS │ SBV/GSO │ Telegram
```

---

## 2. Tech Stack

### Backend

| Library | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| FastAPI | 0.100+ | API framework, auto OpenAPI |
| SQLAlchemy | 2.0+ | ORM, async, migration-ready |
| Alembic | 1.12+ | DB migrations |
| Pydantic | 2.0+ | Schema validation |
| httpx | 0.25+ | Async HTTP (crawling) |
| pandas + numpy | Latest | Feature engineering |
| scikit-learn | Latest | Preprocessing, metrics |
| xgboost | 2.0+ | Scoring (target) |
| tensorflow | 2.15+ | LSTM (target) |
| vnstock | Latest | Data source |
| feedparser | Latest | RSS parsing |
| beautifulsoup4 | Latest | HTML parsing |
| python-jose | Latest | JWT |
| passlib[bcrypt] | Latest | Password hash |
| python-telegram-bot | Latest | Telegram |
| weasyprint | Latest | PDF (text/table only MVP) |

### Frontend

| Library | Bundle | Purpose |
|---|---|---|
| Next.js 14+ | — | App Router, client-side routing (single-user MVP, không SSR session) |
| React 18 | — | UI runtime |
| Lightweight Charts | ~40KB | Candlestick (Stock Detail — cluster 3) |
| Recharts | ~60KB | Line, Bar, Treemap, Pie, Radar (Dashboard, Stock Detail — cluster 2-3) |
| TanStack Table v8 | ~15-30KB | Price Board, sortable tables (cluster 4) |
| next-intl | ~10KB | i18n VIE/ENG; locale persisted localStorage, không URL prefix |
| Lucide React | ~5KB tree-shake | **[v1.2]** Icon library (theme-aware qua `currentColor`) |
| tailwindcss | Dev only | Styling utilities + 4 theme blocks `[data-theme="..."]` trong themes.css |
| MSW (Mock Service Worker) | Dev only | **[v1.2]** API mocking trong prototype/dev; production frontend không dùng — gọi backend thực |

**Loại trừ:** AG-Grid và Highcharts (PRD đề cập nhưng không dùng — TanStack Table + Recharts đã đủ scope).

---

## 3. Project Structure

```
vn-re-ai-screener/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── dependencies.py
│   │   ├── job_lock.py                  # [v1.1] Concurrency control
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── refresh.py
│   │   │   ├── screening.py
│   │   │   ├── dashboard.py
│   │   │   ├── stocks.py
│   │   │   ├── portfolio.py
│   │   │   ├── news.py
│   │   │   ├── backtest.py
│   │   │   ├── export.py
│   │   │   ├── share.py
│   │   │   ├── telegram.py
│   │   │   └── settings.py
│   │   ├── services/
│   │   │   ├── refresh_service.py
│   │   │   ├── screening_service.py
│   │   │   ├── feature_service.py
│   │   │   ├── filter_service.py
│   │   │   ├── risk_service.py
│   │   │   ├── news_service.py
│   │   │   ├── portfolio_service.py
│   │   │   ├── backtest_service.py
│   │   │   ├── export_service.py
│   │   │   ├── share_service.py
│   │   │   └── telegram_service.py
│   │   ├── engines/
│   │   │   ├── base.py                  # Abstract interfaces
│   │   │   ├── scoring_baseline.py
│   │   │   ├── scoring_xgboost.py
│   │   │   ├── price_baseline.py
│   │   │   ├── price_lstm.py
│   │   │   └── entry_engine.py
│   │   ├── crawlers/
│   │   │   ├── vnstock_client.py
│   │   │   ├── news_crawler.py
│   │   │   ├── macro_crawler.py
│   │   │   └── cache_manager.py
│   │   ├── models/                       # SQLAlchemy (16 tables)
│   │   ├── schemas/                      # Pydantic
│   │   ├── repositories/                 # Data access layer
│   │   │   ├── __init__.py
│   │   │   ├── stock_repo.py
│   │   │   ├── price_repo.py
│   │   │   ├── financial_repo.py
│   │   │   ├── screening_repo.py
│   │   │   ├── news_repo.py
│   │   │   ├── portfolio_repo.py
│   │   │   ├── settings_repo.py
│   │   │   └── cache_repo.py
```

**Layer pattern:** API Router → Service → Repository → SQLAlchemy → SQLite. Không query SQL trực tiếp trong Services.

```
│   │   ├── constants/
│   │   │   ├── features.py              # 38 IDs + normalization
│   │   │   ├── enums.py
│   │   │   ├── thresholds.py
│   │   │   └── sources.py
│   │   └── db/
│   │       ├── database.py
│   │       └── seed.py
│   ├── alembic/
│   ├── tests/
│   │   ├── fixtures/                     # 5 mock tickers
│   │   ├── test_filters.py
│   │   ├── test_features.py
│   │   ├── test_scoring.py
│   │   ├── test_entry.py
│   │   ├── test_risk.py
│   │   └── test_api.py
│   ├── requirements.txt
│   └── .env.example                      # [v1.1] Full env vars
│
├── frontend/
│   ├── src/
│   │   ├── app/                          # Next.js App Router pages
│   │   │   ├── (app)/                    # Protected routes (wrapped by ProtectedRoute)
│   │   │   ├── (auth)/                   # Login route group
│   │   │   └── share/                    # Public share routes (cluster 6)
│   │   ├── components/
│   │   │   ├── auth/                     # [v1.2] LoginForm, ProtectedRoute
│   │   │   ├── common/                   # [v1.2] Button, Input, Select, ComingSoon, MswBootstrap
│   │   │   ├── layout/                   # [v1.2] AppShell, Sidebar, Header, Disclaimer
│   │   │   ├── settings/                 # [v1.2] ThemePicker, LanguagePicker (+ cluster 6 sections)
│   │   │   └── ...                       # cluster 2-6 thêm: charts/, tables/, dashboard/, badges/, run/, stock-detail/, price-board/, news/, portfolio/, run-history/, backtest/, export/, share/, telegram/
│   │   ├── contexts/                     # [v1.2] AuthContext, ThemeContext, LocaleContext
│   │   ├── lib/
│   │   │   ├── api.ts                    # apiFetch wrapper + JobConflictError
│   │   │   ├── constants.ts              # Mirror backend enums + STORAGE_KEYS, MOCK_JWT_PREFIX
│   │   │   ├── types.ts                  # [v1.2] ApiSuccess/ApiError envelope + response shapes
│   │   │   └── hooks/                    # cluster 2+ thêm
│   │   ├── messages/                     # [v1.2] next-intl JSON files (path là `messages/`, KHÔNG phải `i18n/`)
│   │   │   ├── vi.json
│   │   │   └── en.json
│   │   ├── mocks/                        # [v1.2] MSW handlers + data fixtures (dev-only, không bundle production)
│   │   │   ├── handlers.ts
│   │   │   └── data/
│   │   └── styles/
│   │       ├── globals.css
│   │       └── themes.css                # 4 theme blocks `[data-theme="..."]`
│   ├── public/
│   │   └── mockServiceWorker.js          # [v1.2] MSW worker (npx msw init public/)
│   └── package.json
│
├── data/
│   ├── whitelist.json
│   ├── fixtures/
│   └── models/
└── docs/
```

---

## TAD Change Log (v1.0 → v1.1 → v1.2)

### From 1st review (v1.0 → v1.1)

| # | Fix Type | Change | Section / File |
|---|---|---|---|
| MF-1 | Must-fix | POST /run async 202, tách /results endpoint | g01, g02 |
| MF-2 | Must-fix | GET /runs/{run_id}/stocks/{ticker} cho Stock Detail | g02 |
| MF-3 | Must-fix | RunStatus 7-state canonical, mapping note cho SRS | g01 |
| MF-4 | Must-fix | DB 16 tables: +backtest_results, +share_links | g03 |
| MF-5 | Must-fix | Job lock: max 1 refresh + 1 screening, 409 CONFLICT | g05 |
| MF-6 | Must-fix | Auth = JWT session, wording clarified | c08 |
| MF-7 | Must-fix | Cache source-level by source+data_type | g04 |
| MF-8 | Must-fix | Feature Normalization Spec (38 features) | c02 |
| SF-1 | Should-fix | GET /runs/{run_id}/results endpoint | g02 |
| SF-2 | Should-fix | Pagination standard (limit/offset) | g02 |
| SF-3 | Should-fix | PDF no-chart MVP (text/table only) | c06 |
| SF-4 | Should-fix | .env.example full fields | g07 |

### From 2nd review (merged in-place)

| # | Fix Type | Change | Section / File |
|---|---|---|---|
| MF-A | Must-fix | Single heavy job lock (no concurrent refresh+screening) | g05 |
| MF-B | Must-fix | SQLite WAL + synchronous + foreign_keys pragmas | g07 |
| SF-5 | Should-fix | Cache wording: "source-level MVP" thay "granular" | g04 |
| SF-6 | Should-fix | GET /health + /version endpoints | g02 |
| SF-7 | Should-fix | run_error field trong screening_runs | g03 |
| SF-8 | Should-fix | repositories/ directory trong project structure | 00 |
| SF-9 | Should-fix | Timeout env vars trong .env.example | g07 |
| MF-C | Must-fix | Architecture diagram sửa thành max 1 heavy job at a time | 00 |
| MF-D | Must-fix | Refresh job status lưu in-memory registry cho MVP, không thêm bảng refresh_jobs | g01 |
| MF-E | Must-fix | SQLite busy_timeout env var + PRAGMA busy_timeout + transaction rules để giảm database lock | g07 |

---

*— End of TAD v1.2 Overview — Hardened & LOCKED (post-prototype reconciliation) — Ready for Vibecoding Plan —*
