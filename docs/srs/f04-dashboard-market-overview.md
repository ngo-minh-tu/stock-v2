---
name: SRS-04 Dashboard & Market Overview
description: Dashboard hiển thị 5 charts (Treemap/Pie/Line/Bar/Radar) + 5 KPI cards sau mỗi screening run. Phase 2.
type: feature
module: SRS-04
prd_fr: FR-02
phase: 2
version: v1.3 LOCKED (cluster 2 reconciliation)
---

# F04 — Dashboard & Market Overview

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f06-top-mua-explainability.md](f06-top-mua-explainability.md), [f08-stock-detail.md](f08-stock-detail.md)
> Related — global: [g02](g02-non-functional-requirements.md) (AC-NF-02 load < 3s), [g03](g03-appendix-enums-constants.md) (Recommendation enum)

## Changelog

- **v1.3 (2026-05-09, cluster 2 reconciliation):** ❌ REMOVED "Trend Comparison: top 5 MUA price history" → ✅ REPLACED bằng "Line: VN-Index + BĐS Index 26 tuần". ❌ REMOVED "Financial Compare: top 5 MUA key metrics" → ✅ REPLACED bằng "Bar: Top 10 mã by AI Score". ❌ REMOVED 6 KPI list ("Avg AI Score" + "Top Upside" — confidence meta-measure + duplicate với TopMUA table) → ✅ REPLACED bằng 5 KPI prototype ("Alpha vs VN-Index" thay thế — chỉ số stock-picking outperform thị trường, có ý nghĩa cao hơn). ❌ REMOVED AC-04-02 "configurable size" → ✅ fixed `size = vốn hóa, color = recommendation`. ➕ ADDED chart layout grid (Treemap full → Pie+Radar 2-col → Line+Bar full), Run selector dropdown, theme switch via CSS variable strings. AC-04-06..09 mới.

## UC-04-01: Display Dashboard After Run

### Preconditions
Có ít nhất 1 screening run hoàn thành

### Display Components

5 charts + 5 KPI cards. Layout grid (top → bottom):

| Row | Component | Span | Data Source | Chart Type | Library |
|---|---|---|---|---|---|
| 1 | Market Treemap | full | all scored stocks (size = market_cap, color = recommendation) | Treemap với CustomCell label | Recharts |
| 2 | Recommendation Pie | 1/2 | buy/hold/sell counts | Donut + center label | Recharts |
| 2 | Sector Radar | 1/2 | 5 nhóm features (fundamental, technical, macro, realestate, sentiment) avg scores | Radar | Recharts |
| 3 | Index Trend | full | VN-Index + BĐS Index 26 tuần (dual series) | Line | Recharts |
| 4 | Top 10 by AI Score | full | top 10 mã có ai_score cao nhất, fill theo recommendation | Bar | Recharts |

> [v1.3] Lý do đổi spec: Line + Bar trong spec gốc dùng "top 5 MUA" (price history + financial metrics) — thông tin này đã có ở Stock Detail (cluster 3). Prototype đổi sang **macro view**: Index Trend cho market context, Top 10 cho ranking — thông tin Dashboard-level mà các page khác không có.

### KPI Cards Specification (5 cards)

| Card | Value | Format | Color |
|---|---|---|---|
| Tổng mã phân tích | `summary.scored_count` | Integer | text-primary |
| Mã MUA | `summary.buy_count` | Integer | `var(--ssi-up)` xanh |
| Mã GIỮ | `summary.hold_count` | Integer | `var(--ssi-ref)` vàng |
| Mã BÁN | `summary.sell_count` | Integer | `var(--ssi-down)` đỏ |
| Alpha vs VN-Index | `summary.alpha_pct` | `+X.X%` hoặc `-X.X%` | xanh nếu ≥ 0, đỏ nếu < 0 |

> [v1.3] "Alpha vs VN-Index" thay 2 KPI cũ ("Avg AI Score" + "Top Upside"): alpha là chỉ số đầu tư stock-picking outperform thị trường — ý nghĩa cao hơn confidence meta-measure; "Top Upside" đã có sẵn trong TopMUA table sortable.

### Run Selector

Dropdown trong empty area của Dashboard header, list 10 run gần nhất (qua `GET /api/runs?limit=10`). Label `dd/MM/yy HH:mm — N mã`. Default chọn `latest` run. User chọn run cũ → toàn bộ 5 chart + 5 KPI reload theo run đó.

### Theme switching

Tất cả chart fill dùng **CSS variable strings** (`fill="var(--ssi-up)"`) thay vì hex constants → SVG được browser resolve theo `[data-theme]` cha → theme switch không cần re-render chart.

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-04-01 | Dashboard load < 3 giây sau khi có data |
| AC-04-02 | Treemap: size = vốn hóa, color = MUA (xanh) / GIỮ (vàng) / BÁN (đỏ). Hover cell → tooltip 3 dòng (ticker / recommendation+score / vốn hóa) đồng bộ recommendation color |
| AC-04-03 | Click treemap cell → navigate to `/stock-detail?run_id=X&ticker=Y` |
| AC-04-04 | Nếu chưa có run → hiển thị empty state với nút "Chạy sàng lọc" (gọi RunButton flow) |
| AC-04-05 | KPI cards + 5 charts auto-refresh khi run mới hoàn thành (qua `lastCompletedRunId` listener — xem [f01 §UC-01-02](f01-core-screening-pipeline.md)) |
| AC-04-06 | Run selector dropdown hiển thị 10 run gần nhất, chọn run cũ → toàn bộ Dashboard reload theo run đó |
| AC-04-07 | Pie chart có center label (donut hole): default "Tổng / N / mã"; hover slice → 3 dòng đồng bộ recommendation color (xanh MUA / vàng GIỮ / đỏ BÁN) |
| AC-04-08 | Radar tooltip dùng custom hover-dot pattern (xem [design.md §6.9](../design.md)) — INWARD placement, không bám cursor, không che PolarAngleAxis labels |
| AC-04-09 | Theme switch (4 themes) → tất cả 5 chart đổi màu ngay, KHÔNG re-render (CSS variable resolution) |
