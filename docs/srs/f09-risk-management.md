---
name: SRS-09 Risk Management
description: Tính stop loss (-10%) + capital allocation + RiskPanel visual (3 sub-cards: StopLoss, Allocation, Confidence). Phase 2.
type: feature
module: SRS-09
prd_fr: FR-07
phase: 2
version: v1.3 LOCKED (cluster 3 reconciliation)
---

# F09 — Risk Management

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f06-top-mua-explainability.md](f06-top-mua-explainability.md), [f08-stock-detail.md](f08-stock-detail.md), [f11-portfolio-lite.md](f11-portfolio-lite.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (STOP_LOSS_PCT, Recommendation enum, WarningBadge)

## Changelog

- **v1.3 (2026-05-09, cluster 3 reconciliation):** + UC-09-03 RiskPanel visual layout (3 sub-cards). StopLossCard panel-frame design (chevron caption + big red price + distance pill + gap-track). AllocationCard skip-allocation render. ConfidenceCard bar visualization (final \| penalty) + warning badges chips với tooltip.

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

## UC-09-03: RiskPanel Visual Layout (Stock Detail Section 5)

> [v1.3] Cluster 3 — 3-column grid trong Stock Detail page

3 sub-cards side-by-side, equal width:

### StopLossCard

Panel-frame card design (xem [design.md §6.13](../design.md)):
- **Chevron caption** "Cắt lỗ tại" trên cùng
- **Big red price** ở center, `tabular-nums`, large font, `var(--color-theme-text-primary)` color thay bằng `var(--ssi-down)` (đỏ)
- **Distance pill** dưới price: `-10%` từ entry/current
- **Gap-track** visual: small line indicator thay vì plain text
- **Calc note** (1 dòng nhỏ): `"buy_price × 0.90"` hoặc `"current_price × 0.90 (chưa có buy_price)"`

### AllocationCard

| Case | Render |
|---|---|
| `total_capital > 0` AND mã có allocation | VND format `fr-FR` (e.g. `150.000.000 VNĐ`) + weight `%` (e.g. `30% of 500M`) + based-on note |
| `total_capital ≤ 0` | Render placeholder "Bỏ qua phân bổ vốn" (AC-09-06 + AC-09-08) |

### ConfidenceCard

- **Visual bar** 2 segment: `final` (xanh) `\|` `penalty` (cam). Width tỷ lệ với `confidence_raw`
- **3 label** tabular-aligned: `confidence_final` / `confidence_penalty` / `confidence_raw`
- **Warning badges chips** dưới bar — list mã `risk.warning_badges[]`, mỗi chip có tooltip giải thích trigger condition (vi/en theo locale, từ [warning-badges.ts](../../frontend/src/mocks/data/warning-badges.ts) hoặc backend equivalent)

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-09-08 | RiskPanel render 3-column grid (StopLoss / Allocation / Confidence). INSUFFICIENT_DATA case → render "Không đủ data" message thay vì 3 card |
| AC-09-09 | StopLossCard panel-frame layout: chevron caption + big red price center + distance pill + gap-track |
| AC-09-10 | AllocationCard: `total_capital ≤ 0` → "Bỏ qua phân bổ" placeholder (KHÔNG hide card hoàn toàn) |
| AC-09-11 | ConfidenceCard bar visualizes `confidence_final` xanh + `confidence_penalty` cam tương ứng width |
| AC-09-12 | Mỗi warning badge chip có tooltip giải thích trigger (e.g. "D/E ≥ 3 AND < 4") |
