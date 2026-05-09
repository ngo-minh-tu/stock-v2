---
id: g08
title: Coding Packages — Vibecoding Order (Package 0–10)
parent: 00-tad-system-overview.md
type: global
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§27)
---

# g08 — Coding Packages (Appendix)

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Thứ tự vibecoding module-by-module.

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
- Dashboard page (6 charts)
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
