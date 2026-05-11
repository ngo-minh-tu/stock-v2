# VN Real Estate AI Screener

> *Dữ liệu dẫn đường, quyết định thuộc về bạn* — Ngô Minh Tú

AI-assisted screener cho cổ phiếu bất động sản niêm yết Việt Nam. Single-user MVP — frontend Next.js + backend FastAPI + SQLite.

**Status (2026-05-11):** MVP Phase 0-11 đã ship. Sẵn sàng integration testing với production data.

---

## 1. Bắt đầu

| Tôi muốn… | Đi tới |
|---|---|
| Chạy backend local | [mvp/README.md](mvp/README.md) — uv sync + alembic + seed + uvicorn (5 phút) |
| Chạy frontend local | [frontend/README.md](frontend/README.md) — npm install + .env.local + npm run dev |
| Xem build history + drift register | [report/mvp-build-summary.md](report/mvp-build-summary.md) |
| Đọc spec (PRD/SRS/TAD) | [docs/](docs/) |
| Audit từng phase | [mvp/phases/](mvp/phases/) — 11 SUMMARY.md per phase |

Quick start full stack:
```bash
# Terminal 1 — backend
cd mvp/code && uv sync && uv run alembic upgrade head && uv run python -m app.db.seed
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
│   ├── PLAN.md           # 11-phase build plan
│   ├── code/             # source backend + tests + Dockerfile
│   └── phases/           # SUMMARY.md per phase
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
├── report/               # Build summaries
│   ├── mvp-build-summary.md
│   └── cluster-{1..6}-summary.md
├── script/               # Helper bash (run-prototype, run-ngrok)
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

Chi tiết drift register + post-MVP backlog: [report/mvp-build-summary.md](report/mvp-build-summary.md).

---

## 5. License & author

- **Author:** Ngô Minh Tú (Business-Analyst: Claude AI)
- **License:** Private — chưa cấp phép phân phối công khai.
- **Disclaimer:** Tool hỗ trợ phân tích, KHÔNG phải khuyến nghị đầu tư. Người dùng tự chịu trách nhiệm quyết định.

---

*Cập nhật 2026-05-11 (Phase 11 MVP).*
