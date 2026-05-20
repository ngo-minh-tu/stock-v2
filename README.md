# VN Real Estate AI Screener

> *Dữ liệu dẫn đường, quyết định thuộc về bạn* — Ngô Minh Tú

AI-assisted screener cho cổ phiếu bất động sản niêm yết Việt Nam. Single-user MVP — frontend Next.js + backend FastAPI + SQLite.

**Status (2026-05-20):** MVP Phase 0-18 đã ship. Mốc 1 (demo stability), Mốc 2 (production-data hardening + closure thật) và Mốc 3 steps 1-7 (financial source fallback + release hardening) đã đóng. Prod DB scored_count=17 với real vnstock data; `vnstock_price=FRESH` + `vnstock_financial=FRESH`. Mốc 3 step 8 (Playwright critical-path smoke) carry sang Phase 19.

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
│   ├── code/             # source backend + tests + Dockerfile + 4 env templates
│   └── phases/           # SUMMARY.md per phase (0-18)
├── frontend/             # Frontend Next.js 14 (active, post-Phase 9 swap)
│   ├── README.md
│   └── src/              # app router + components + lib
├── prototype/            # FE prototype FROZEN 2026-05-08 (cluster 1-6 reference)
├── docs/                 # PRD v0.5A + SRS v1.4 + TAD v1.5 + design.md
│   ├── PRD_v0.5A_Final_Locked.md
│   ├── srs/              # f01-f17 + g01-g04
│   ├── tad/              # g01-g09 + c01-c08
│   ├── design.md
│   └── system-architecture/
├── plan/                 # PLAN.md (18+ phase build plan, promoted from mvp/ 2026-05-16)
├── report/               # Báo cáo theo folder chủ đề
│   ├── cluster-prompts/  # cluster-{1..6}-summary.md
│   ├── mvp-build/        # SUMMARY.md
│   └── phase-mvp/        # phase-12 ... phase-18
├── script/               # Bash helpers (run-prototype, run-ngrok, backup-db, restore-db, cron-refresh)
└── prompts/              # Cluster build prompts
```

`prototype/` đã frozen, KHÔNG develop tiếp. FE active = `frontend/` (forked 2026-05-09).

---

## 3. Stack tóm tắt

| Layer | Choice | Lý do |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind | TAD g08 §FE pattern |
| Charts | lightweight-charts (candlestick) + Recharts (radar/treemap/line) | TAD g09 §2 |
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
| 19 | Playwright critical-path smoke (Mốc 3 step 8) | ⏭ next |

Chi tiết drift register + post-MVP backlog: [report/mvp-build/SUMMARY.md](report/mvp-build/SUMMARY.md). Phase 16-18 deliverables: [mvp/phases/phase-16-mvp-data-readiness-closure/](mvp/phases/phase-16-mvp-data-readiness-closure/), [phase-17-financial-source-fallback/](mvp/phases/phase-17-financial-source-fallback/), [phase-18-mvp-release-hardening/](mvp/phases/phase-18-mvp-release-hardening/).

---

## 5. License & author

- **Author:** Ngô Minh Tú (Business-Analyst: Claude AI-OpenAI Codex)
- **License:** Private — chưa cấp phép phân phối công khai.
- **Disclaimer:** Tool hỗ trợ phân tích, KHÔNG phải khuyến nghị đầu tư. Người dùng tự chịu trách nhiệm quyết định.

---

*Cập nhật 2026-05-20 (Phase 18 release hardening đã đóng — Mốc 1+2+Mốc 3 steps 1-7).*
