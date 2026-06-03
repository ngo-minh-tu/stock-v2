---
title: System Architecture — Mermaid Diagrams
source: tổng hợp từ docs/tad/ (00, g01-g08, c01-c10)
generated: 2026-05-10
reconciled: 2026-06-03 — synced tới code @ Phase 28 (FE Next 16.2.6 + Turbopack; macro fetch = World Bank API + vnstock VN-Index)
status: companion to TAD v1.5 LOCKED
---

# System Architecture — Mermaid Diagrams

Bộ sơ đồ Mermaid tổng hợp kiến trúc hệ thống **VN Real Estate AI Screener**, dựng từ:

- [TAD v1.5 LOCKED](../tad/) — `docs/tad/` (00 system overview, g01–g08 global, c01–c10 component)
- Bám theo [PRD v0.5A](../PRD_v0.5A_Final_Locked.md) + [SRS](../srs/) + [design.md](../design.md)

> Mục đích: cho PO + dev nhìn 1 lần thấy cả hệ thống — luồng dữ liệu, ranh giới layer, vòng đời run, schema DB, pipeline scoring.

---

## Index

| # | Diagram | Phạm vi | Trỏ tới TAD |
|---|---|---|---|
| [01](01-system-context.md) | System Context | Actors ↔ Frontend ↔ Backend ↔ External | [00 §1](../tad/00-tad-system-overview.md) |
| [02](02-backend-layers.md) | Backend Layers | API → Service → Repository → SQLAlchemy → SQLite + engines + crawlers + job lock | [00 §3](../tad/00-tad-system-overview.md), [g05](../tad/g05-cross-cutting.md) |
| [03](03-frontend-stack.md) | Frontend Stack | Provider stack 7 layers + Next.js route groups + hooks (`apiFetch`, `usePolling`, `useApiResource`) | [g05 §4](../tad/g05-cross-cutting.md), [c08](../tad/c08-auth.md), [c09](../tad/c09-theme-i18n.md) |
| [04](04-runtime-flows.md) | Runtime Flows | Sequence diagrams (refresh, screening, backtest 2-stage) + RunStatus 7-state machine | [g01](../tad/g01-runtime.md), [g02 §8.5](../tad/g02-api.md) |
| [05](05-database-erd.md) | Database ERD | 16 tables + relationships | [g03](../tad/g03-database.md) |
| [06](06-feature-pipeline.md) | Feature Pipeline | 4 filter rounds → 38 features → Scoring / Price / Entry / Risk engines | [c01](../tad/c01-engines.md), [c02](../tad/c02-feature-engineering.md), [c03](../tad/c03-entry-engine.md) |
| [07](07-cache-cross-cutting.md) | Cache & Cross-cutting | Cache sources + TTL + job lock state + error envelope | [g04](../tad/g04-cache.md), [g05](../tad/g05-cross-cutting.md) |

---

## Cách đọc

- Mỗi sơ đồ là code block ```` ```mermaid ```` — VS Code có extension Mermaid (hoặc preview built-in) sẽ render.
- Chú thích trong diagram trỏ về file TAD gốc + section để dễ trace.
- Khi TAD đổi → cập nhật cùng commit. Không để diagram drift khỏi spec.
- Đây **không** phải spec — diagram là view phụ, spec là TAD/SRS. Mâu thuẫn → tin TAD.

## Tech stack tóm tắt

| Layer | Stack |
|---|---|
| Frontend | Next.js 16.2.6 App Router + Turbopack, React 18.3.1, TanStack Table v8, Recharts, Lightweight Charts v4.2.3, next-intl 4.12.0, Tailwind, Lucide, MSW (dev opt-in) |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0 async, Alembic, Pydantic 2, httpx, pandas/numpy, scikit-learn, xgboost, tensorflow, vnstock, weasyprint |
| Database | SQLite (WAL + busy_timeout=30s), 16 tables — migration-ready PostgreSQL |
| Auth | JWT 24h + bcrypt, single-user MVP, localStorage token |
| Concurrency | In-memory `JobLock` singleton — max 1 heavy job (refresh ∪ screening ∪ backtest) |
