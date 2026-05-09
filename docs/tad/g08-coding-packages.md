---
id: g08
title: Coding Packages — Vibecoding Order (Package 0–10)
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§27); cluster 1 reconciliation 2026-05-09
version: v1.2 LOCKED (post-prototype reconciliation)
---

# g08 — Coding Packages (Appendix)

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Thứ tự vibecoding module-by-module.

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** ➕ Bổ sung §"Frontend prototype precedes packages" giải thích quan hệ giữa Package N (kế hoạch backend+frontend tích hợp) và Cluster N (prototype frontend riêng đã hoàn thành 2026-05-04 → 2026-05-08). Frontend portion của Package 8/9/10 đã được prototype xong, MVP build = backend Package 0-7 + integrate prototype frontend code thay vì rebuild from scratch.

---

## Frontend Prototype Precedes Packages

> [v1.2] Đọc trước khi follow Package list bên dưới

Trước khi bắt đầu Vibecoding theo Package 0-10, dự án đã chạy **prototype frontend phase** từ 2026-05-04 đến 2026-05-08, organized thành 6 clusters tập trung vào UI/UX validation:

| Cluster | Tên | Coverage trong Package list |
|---|---|---|
| 1 | Shell & Foundation | Phần FE của Package 3 (Auth + Settings page shell) + Package 10 (Theme + i18n) |
| 2 | Screening Flow | Phần FE của Package 8 (Dashboard + Top MUA + Red Flags) + Package 7 (Run trigger UI) |
| 3 | Stock Detail | Phần FE của Package 8 (Stock Detail page với candlestick + radar + breakdown) |
| 4 | Market & Browse | Phần FE của Package 9 (Price Board + News page) |
| 5 | Personal & History | Phần FE của Package 9 (Portfolio Lite + Run History + Compare) + Package 10 (Backtest UI) |
| 6 | Export & Integrations | Phần FE của Package 9 (Telegram + PDF) + Package 10 (Settings full + Share link) |

**Kế hoạch MVP build sau prototype:**
1. Package 0-2: Backend bootstrap + DB setup (mới, chưa làm trong prototype)
2. Package 3-7: Backend services + APIs (mới, prototype mock với MSW)
3. Package 8-10: **KHÔNG rebuild frontend from scratch**. Thay vào đó: copy prototype frontend code vào `frontend/`, replace MSW handlers bằng calls to backend FastAPI thực, fix integration bugs.

**Lý do:** prototype đã được user duyệt UI/UX → spec docs đã reconcile theo prototype (xem [TAD changelog v1.2](00-tad-system-overview.md)) → MVP frontend code phải MATCH prototype, không phải MATCH Package list cũ. Package list bên dưới giữ làm reference cho **scope** mỗi package (test coverage, AC validation), không phải là build order frontend.

---

## Package 0 — Project Bootstrap
- Monorepo structure (backend + frontend)
- FastAPI app skeleton
- Next.js app skeleton
- .env config
- SQLite + SQLAlchemy + Alembic setup
- Basic logging

## Package 1 — Domain Constants & Types
- All enums (RunStatus 7-state, Recommendation, EntrySignal, etc.)
- 38 Feature IDs + normalization table
- Raw indicator IDs
- Thresholds + penalties constants
- Error codes
- Pydantic base schemas
- TypeScript mirror constants

## Package 2 — Database & Seed
- 16 tables + indexes
- Alembic initial migration
- Seed whitelist ~81 mã
- Default settings
- Initial user + password hash

## Package 3 — Auth + Settings
- POST /auth/login → JWT
- PUT /auth/password
- Route protection middleware
- GET/PUT /settings
- Frontend login page + auth context

## Package 4 — Refresh Data Layer
- cache_metadata operations
- vnstock wrapper (rate limit 0.5s)
- Price + financial refresh
- Macro crawler stubs
- News crawler stubs
- POST /refresh/all (async 202)
- Refresh status polling

## Package 5 — Feature Engineering + Filters
- 4 filtering rounds
- 38 scoring feature calculations
- Raw indicator calculations
- Missing data handling + imputation
- Feature normalization (baseline)

## Package 6 — Engines
- Baseline Scoring Engine (weighted normalize)
- Baseline Price Engine
- Entry Point Engine (deterministic, priority order)
- Risk service (stop loss, allocation, warnings, confidence penalty)

## Package 7 — Screening Orchestrator
- POST /run (async 202)
- Background task: filter → score → predict → entry → risk → save
- Run status polling
- Job lock (409 CONFLICT)
- GET /runs/{run_id}/results
- GET /runs/{run_id}/dashboard (aggregate)
- GET /runs/{run_id}/stocks/{ticker}

## Package 8 — Core UI
- Layout shell (sidebar + header)
- Dashboard page (5 charts + 5 KPI cards)
- Top MUA page (list + expand + warnings)
- Red Flags page
- Stock Detail page (candlestick + radar + breakdown)
- Run button + status polling + progress bar

## Package 9 — Extended
- Price Board (TanStack Table, TTCK colors)
- News crawler real (5 sources, RSS)
- Sentiment pipeline
- News page
- Portfolio Lite (CRUD + P&L)
- Run History + Compare 2 runs
- Telegram bot
- PDF export (text/table, no charts)

## Package 10 — Polish
- Theme system (4 states, CSS vars)
- i18n VIE/ENG (next-intl)
- design.md integration
- Share link
- Backtest Core (accuracy + error + ROI vs VN-Index)
- Settings page full
- Bug fixes + QA against all ACs

**Rule: Mỗi Package phải pass tests trước khi chuyển Package tiếp.**
