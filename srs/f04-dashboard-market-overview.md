---
name: SRS-04 Dashboard & Market Overview
description: Dashboard hiển thị 6 charts + KPI cards sau mỗi screening run. Treemap, Pie, Line, Bar, Radar, KPI. Phase 2.
type: feature
module: SRS-04
prd_fr: FR-02
phase: 2
---

# F04 — Dashboard & Market Overview

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f06-top-mua-explainability.md](f06-top-mua-explainability.md), [f08-stock-detail.md](f08-stock-detail.md)
> Related — global: [g02](g02-non-functional-requirements.md) (AC-NF-02 load < 3s), [g03](g03-appendix-enums-constants.md) (Recommendation enum)

## UC-04-01: Display Dashboard After Run

### Preconditions
Có ít nhất 1 screening run hoàn thành

### Display Components

| Component | Data Source | Chart Type | Library |
|---|---|---|---|
| Market Treemap | all scored stocks | Treemap | Recharts |
| Recommendation Pie | buy/hold/sell counts | Pie/Donut | Recharts |
| Trend Comparison | top 5 MUA price history | Line | Recharts |
| Financial Compare | top 5 MUA key metrics | Bar | Recharts |
| Sector Radar | 5 nhóm avg scores | Radar | Recharts |
| KPI Cards | counts + avg score + top upside | Cards | Custom |

### KPI Cards Specification

| Card | Value | Format |
|---|---|---|
| Tổng mã phân tích | scored_count | Integer |
| Mã MUA | buy_count | Integer, green |
| Mã GIỮ | hold_count | Integer, yellow |
| Mã BÁN | sell_count | Integer, red |
| Avg AI Score (MUA) | mean(scores where rec=MUA) | 0.0 |
| Top Upside | max(upside_pct) + ticker | +XX.X% (TICKER) |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-04-01 | Dashboard load < 3 giây sau khi có data |
| AC-04-02 | Treemap: size = vốn hóa hoặc AI Score (configurable), color = MUA(green)/GIỮ(yellow)/BÁN(red) |
| AC-04-03 | Click treemap cell → navigate to Stock Detail |
| AC-04-04 | Nếu chưa có run → hiển thị empty state với nút "Chạy sàng lọc" |
| AC-04-05 | KPI cards auto-refresh khi run mới hoàn thành |
