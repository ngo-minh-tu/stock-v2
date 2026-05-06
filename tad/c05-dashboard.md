---
id: c05
title: Dashboard Aggregate
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§15)
---

# c05 — Dashboard Aggregate

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f04-dashboard-market-overview.md](../srs/f04-dashboard-market-overview.md)
>
> Related — global: [g02-api.md](g02-api.md) (`GET /api/runs/{run_id}/dashboard`), [g03-database.md](g03-database.md) (queries `screening_results` for aggregation)

---

## 1. Endpoint

`GET /api/runs/{run_id}/dashboard` returns single payload for all 6 charts + KPIs. Computed on-the-fly from screening_results. With 81 mã, computation < 100ms.
