---
id: c03
title: Entry Point Engine — Deterministic, Priority Order
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§13); cluster 3 reconciliation 2026-05-09
version: v1.3 LOCKED (cluster 3 reconciliation)
---

# c03 — Entry Point Engine

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f03-entry-point-logic.md](../srs/f03-entry-point-logic.md)
>
> Related — global: [g01-runtime.md](g01-runtime.md) (called during SCORING state in screening flow), [g03-database.md](g03-database.md) (writes `entry_signal`, `entry_reason_code`, `support_zone`, `resistance_zone` into `screening_results`)

## Changelog

- **v1.3 (2026-05-09, cluster 3 reconciliation):** + §2 Frontend prototype anchor override pattern (cluster 2 mock thiếu Step 2 enforce — cluster 3 fix qua `decideEntrySignal`).

---

## 1. Implementation

Implementation theo SRS-03. Priority order. First match wins. Xem SRS-03 cho full pseudocode + test fixtures.

Engine class: `app/engines/entry_engine.py` — không phải abstract, logic cố định.

Output schema: `EntryResult { signal, support_zone, resistance_zone, reason_code, raw_indicators_used }` — xem [c01-engines.md](c01-engines.md) §1.

---

## 2. Frontend Prototype Anchor Pattern

> [v1.3] Cluster 3 — `frontend/src/mocks/data/run-compute.ts` `decideEntrySignal(ticker, score, rec, badges)`

Backend MVP chỉ implement Step 1-9 priority order theo SRS-03 (KHÔNG có anchor overrides). Frontend prototype dùng anchor pattern để demo 7-enum coverage trong UI:

| Ticker | Anchored signal |
|---|---|
| VHM | BUY_STRONG |
| KDH | BUY_NOW (+1 badge HIGH_INVENTORY → confidence -5pp) |
| NLG | WAIT_FOR_BREAKOUT |
| DXG | WAIT_FOR_PULLBACK |
| PDR | WAIT_FOR_CONFIRMATION |
| MOCK_HOLD / MOCK_SELL | NO_ENTRY (qua Step 2 gate) |
| MOCK_INSUFFICIENT | INSUFFICIENT_DATA (excluded round 4 → 404 fallback) |

**Critical:** Step 2 (rec≠MUA → NO_ENTRY) MUST enforce ngay cả ở mock layer. Cluster 2 `entrySignalFromScore` chỉ phụ thuộc score+badges → trả `WAIT_FOR_*` cho cả mã GIỮ/BÁN (vi phạm AC-03-02 + AC-03-09). Cluster 3 fix bằng `decideEntrySignal` — recommendation gate ưu tiên trước anchor + score logic.
