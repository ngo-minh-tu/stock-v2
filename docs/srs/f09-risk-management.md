---
name: SRS-09 Risk Management
description: Tính stop loss (-10% từ buy_price hoặc current_price) và phân bổ vốn theo AI score weights. Phase 2.
type: feature
module: SRS-09
prd_fr: FR-07
phase: 2
---

# F09 — Risk Management

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f06-top-mua-explainability.md](f06-top-mua-explainability.md), [f11-portfolio-lite.md](f11-portfolio-lite.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (STOP_LOSS_PCT, Recommendation enum)

## UC-09-01: Calculate Stop Loss

### Formula
`stop_loss_price = reference_price × 0.90`

| Condition | reference_price |
|---|---|
| Mã có trong portfolio (đã mua) | buy_price |
| Mã chưa mua | current_price |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-09-01 | stop_loss = buy_price × 0.90 nếu có buy_price |
| AC-09-02 | stop_loss = current_price × 0.90 nếu chưa mua |
| AC-09-03 | Stop loss hiển thị ở: Stock Detail, Top MUA expand, PDF export |

## UC-09-02: Calculate Capital Allocation

### Preconditions
- total_capital > 0
- ≥1 mã MUA

### Formula

```
buy_stocks = [s for s in results if s.recommendation == MUA]
total_score = sum(s.ai_score for s in buy_stocks)

for s in buy_stocks:
    s.weight = s.ai_score / total_score
    s.allocation = total_capital × s.weight
```

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-09-04 | sum(allocations) == total_capital (±1 VNĐ rounding) |
| AC-09-05 | Mã score cao hơn → allocation lớn hơn |
| AC-09-06 | Nếu total_capital = 0 → allocation section ẩn |
| AC-09-07 | Nếu 0 mã MUA → hiển thị "Không có mã đủ điều kiện phân bổ" |
