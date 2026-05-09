---
name: SRS-08 Stock Detail
description: Trang chi tiết mã: candlestick + radar + entry signal + risk + breakdown 38 features. Phase 2.
type: feature
module: SRS-08
prd_fr: FR-06
phase: 2
---

# F08 — Stock Detail

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f02-feature-engineering.md](f02-feature-engineering.md), [f03-entry-point-logic.md](f03-entry-point-logic.md), [f07-red-flags-risk-warnings.md](f07-red-flags-risk-warnings.md), [f09-risk-management.md](f09-risk-management.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (Recommendation, EntrySignal, WarningBadge, 38 Feature IDs)

## UC-08-01: Display Full Stock Analysis

### Preconditions
Mã đã được scored

### Layout Sections

```
┌─────────────────────────────────────────────────┐
│ Header: Ticker + Name + Rec Badge + Score Ring  │
├─────────────────────────────────────────────────┤
│ Left: Candlestick Chart (Lightweight Charts)     │
│   - OHLCV data                                   │
│   - MA20/50/200 overlays                         │
│   - Bollinger Bands overlay                      │
│   - Support/Resistance lines                     │
│   - Volume bars below                            │
├─────────────────────────────────────────────────┤
│ Right: Radar Chart (Recharts)                    │
│   - 5 axes: Fundamental, Technical, Macro,       │
│     BĐS Specific, Sentiment                     │
│   - Score 0-100 per group                        │
├─────────────────────────────────────────────────┤
│ Entry Signal Card                                │
│   Signal: BUY_NOW                                │
│   "Có thể mua ngay — chiết khấu NAV 17%..."    │
│   Support: 30.500 | Resistance: 36.000          │
├─────────────────────────────────────────────────┤
│ Risk Card                                        │
│   Stop Loss: 29.250 (-10%)                       │
│   Warning Badges: [Tồn kho cao]                  │
│   Allocation: 150M (30%)                         │
├─────────────────────────────────────────────────┤
│ Breakdown Table: 38 features with values          │
│   Grouped by 5 nhóm, color-coded good/bad        │
└─────────────────────────────────────────────────┘
```

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-08-01 | Candlestick hiển thị ≥6 tháng data |
| AC-08-02 | Radar chart có đúng 5 axes, scores 0-100 |
| AC-08-03 | Entry signal hiển thị đúng enum + human-readable reason |
| AC-08-04 | Breakdown table hiển thị đủ 38 features (hoặc ghi "N/A" nếu imputed) |
| AC-08-05 | Feature value color: green nếu good direction, red nếu bad |
