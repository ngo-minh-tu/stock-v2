---
name: SRS-11 Portfolio Lite
description: CRUD danh mục (ticker, quantity, buy_price, buy_date) + tính lãi/lỗ + stop loss. Phase 3.
type: feature
module: SRS-11
prd_fr: FR-09
phase: 3
---

# F11 — Portfolio Lite

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f09-risk-management.md](f09-risk-management.md)
> Related — global: [g01](g01-global-errors-and-validation.md) (ticker/quantity/price validation), [g03](g03-appendix-enums-constants.md) (STOP_LOSS_PCT)

## UC-11-01: CRUD Portfolio Holdings

### Data Model

```
{
  holding_id: auto,
  ticker: string (FK to stocks),
  quantity: int (> 0),
  buy_price: float (> 0),
  buy_date: date,
  created_at: datetime,
  updated_at: datetime
}
```

### Derived Fields (calculated, not stored)

```
current_price     = latest price from vnstock/cache
market_value      = quantity × current_price
cost_basis        = quantity × buy_price
unrealized_pnl    = market_value - cost_basis
unrealized_pnl_pct = unrealized_pnl / cost_basis × 100
stop_loss_price   = buy_price × 0.90
```

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-11-01 | CRUD: tạo, đọc, sửa, xóa holding |
| AC-11-02 | quantity ≤ 0 → validation error |
| AC-11-03 | buy_price ≤ 0 → validation error |
| AC-11-04 | ticker không trong whitelist → validation error |
| AC-11-05 | Lãi/lỗ tính chính xác theo formula trên |
| AC-11-06 | Stop loss reference dùng buy_price (không phải current_price) |
