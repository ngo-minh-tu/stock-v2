---
id: c03
title: Entry Point Engine — Deterministic, Priority Order
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§13)
---

# c03 — Entry Point Engine

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f03-entry-point-logic.md](../srs/f03-entry-point-logic.md)
>
> Related — global: [g01-runtime.md](g01-runtime.md) (called during SCORING state in screening flow), [g03-database.md](g03-database.md) (writes `entry_signal`, `entry_reason_code`, `support_zone`, `resistance_zone` into `screening_results`)

---

## 1. Implementation

Implementation theo SRS-03. Priority order. First match wins. Xem SRS-03 cho full pseudocode + test fixtures.

Engine class: `app/engines/entry_engine.py` — không phải abstract, logic cố định.

Output schema: `EntryResult { signal, support_zone, resistance_zone, reason_code, raw_indicators_used }` — xem [c01-engines.md](c01-engines.md) §1.
