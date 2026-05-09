---
id: c05
title: Dashboard Aggregate
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§15); cluster 2 reconciliation 2026-05-09
version: v1.3 LOCKED (cluster 2 reconciliation)
---

# c05 — Dashboard Aggregate

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f04-dashboard-market-overview.md](../srs/f04-dashboard-market-overview.md)
>
> Related — global: [g02-api.md](g02-api.md) (`GET /api/runs/{run_id}/dashboard`), [g03-database.md](g03-database.md) (queries `screening_results` for aggregation)

## Changelog

- **v1.3 (2026-05-09, cluster 2 reconciliation):** ❌ REMOVED 1-line stub "single payload for all 6 charts + KPIs" → ✅ REPLACED bằng full architecture: §1 Backend endpoint + DashboardResponse shape, §2 Frontend layout (5 charts + 5 KPIs), §3 Recharts patterns (Treemap CustomCell, dual-series Line, recommendationColor helper), §4 Theme-aware via CSS variable strings, §5 Reload-on-lastCompletedRunId pattern.

---

## 1. Backend Endpoint

`GET /api/runs/{run_id}/dashboard` returns single payload for **5 charts + 5 KPI cards**. Computed on-the-fly từ `screening_results`. Với 81 mã, computation < 100ms.

### DashboardResponse shape

```ts
type DashboardResponse = {
  run_id: string;
  run_at: string;        // ISO 8601
  summary: {
    scored_count: number;
    buy_count: number;
    hold_count: number;
    sell_count: number;
    alpha_pct: number;   // Dashboard alpha vs VN-Index (%)
  };
  treemap: Array<{
    ticker: string;
    name: string;
    market_cap: number;          // size (tỷ VNĐ)
    ai_score: number;
    recommendation: 'MUA' | 'GIỮ' | 'BÁN';
  }>;
  pie: Array<{                    // 3 entries
    name: 'MUA' | 'GIỮ' | 'BÁN';
    value: number;
  }>;
  index_trend: Array<{            // 26 weekly points
    week: string;                 // ISO date
    vnindex: number;
    bds_index: number;
  }>;
  top10: Array<{                  // top 10 by ai_score DESC
    ticker: string;
    ai_score: number;
    recommendation: 'MUA' | 'GIỮ' | 'BÁN';
  }>;
  radar: {                        // 5 sector averages
    fundamental: number;
    technical: number;
    macro: number;
    realestate: number;
    sentiment: number;
  };
};
```

---

## 2. Frontend Layout

```
┌────────────────────────────────────────────────────┐
│  KPICards (5 cards: Scored | MUA | GIỮ | BÁN | α) │
├────────────────────────────────────────────────────┤
│  ChartCard: TreemapChart                           │ full row
├──────────────────────────┬─────────────────────────┤
│  ChartCard: PieChart     │  ChartCard: RadarChart  │ 2-col
├──────────────────────────┴─────────────────────────┤
│  ChartCard: LineChart (VN-Index + BĐS)             │ full row
├────────────────────────────────────────────────────┤
│  ChartCard: BarChart (Top 10)                      │ full row
└────────────────────────────────────────────────────┘
```

Components: `<DashboardGrid>` wraps `<KPICards>` + 5× `<ChartCard>`. Each ChartCard có title + height + body. `<RunSelector>` đặt ở Dashboard header (chọn run cũ → reload toàn bộ).

---

## 3. Recharts Patterns

| Chart | Component | Notable |
|---|---|---|
| Treemap | `<TreemapChart>` | `<CustomCell>` SVG renderer (built-in label kém với varying cell sizes) — render label + score inside cell theo width/height threshold |
| Pie (Donut) | `<PieChart>` | `innerRadius=50%, outerRadius=72%`. Center label overlay (donut hole) — default "Tổng / N / mã"; hover slice → 3 dòng cùng recommendation color. KHÔNG dùng recharts `<Tooltip>` (xem [design.md §6.8](../design.md)) |
| Line | `<LineChart>` | Dual series: VN-Index + BĐS Index 26 tuần. `isAnimationActive=false` để theme switch không lag |
| Bar | `<BarChart>` | Top 10 by AI Score. Fill mỗi bar qua `recommendationColor(rec)` helper → CSS variable string |
| Radar | `<RadarChart>` | 5 axes (fundamental/technical/macro/realestate/sentiment). Custom hover-dot pattern thay recharts default `<Tooltip>` (xem [design.md §6.9](../design.md)). PolarRadiusAxis angle=45 để tránh đè axis labels. **Reused** ở [Stock Detail ScoreBreakdown](../srs/f08-stock-detail.md) cluster 3 với dual-series overlay (ticker + industry avg lấy từ `r.computed.dashboard.radar` — same run = same peer group) |

### `recommendationColor()` helper (shared)

```ts
// frontend/src/components/charts/ChartCard.tsx
export function recommendationColor(rec: 'MUA' | 'GIỮ' | 'BÁN'): string {
  switch (rec) {
    case 'MUA': return 'var(--ssi-up)';     // xanh
    case 'GIỮ': return 'var(--ssi-ref)';    // vàng
    case 'BÁN': return 'var(--ssi-down)';   // đỏ
  }
}
```

Reused bởi: TreemapChart cell fill, BarChart bar fill, PieChart slice fill, KPI card text color.

---

## 4. Theme-Aware Charts

**Pattern:** SVG `fill` + `stroke` dùng CSS variable string (`var(--ssi-up)`) thay vì hex constant. Browser resolve theo `[data-theme]` attribute trên `<html>` parent → khi user đổi theme, chart đổi màu **không cần re-render** React.

```tsx
// ✅ Đúng — theme-aware
<Cell fill="var(--ssi-up)" />
<rect fill={recommendationColor(rec)} />

// ❌ Sai — hardcoded hex, theme switch không tác động
<Cell fill="#22c55e" />
```

**Tooltip styling:** dùng `--color-theme-tooltip-background` + `--color-theme-tooltip-border` (declared cho cả 4 theme — xem [design.md §4.x](../design.md)). 8 chart components share biến này.

---

## 5. Reload Pattern: `lastCompletedRunId` Listener

Dashboard, TopMUA, RedFlags pages đều dùng pattern:

```tsx
// frontend/src/app/(app)/page.tsx (Dashboard)
const { lastCompletedRunId } = useRun();
const [reloadKey, setReloadKey] = useState(0);

useEffect(() => {
  if (lastCompletedRunId) setReloadKey(k => k + 1);
}, [lastCompletedRunId]);

const { data } = useApiResource<DashboardResponse>(
  `/api/runs/${selectedRunId}/dashboard`,
  reloadKey,
);
```

→ Khi run mới hoàn thành, `RunContext` cập nhật `lastCompletedRunId` → các page tự bump `reloadKey` → `useApiResource` re-fetch. KHÔNG cần manual F5.

Xem [g01 §4 Frontend Polling Pattern](g01-runtime.md) cho `useApiResource` + `usePolling` hook spec.
