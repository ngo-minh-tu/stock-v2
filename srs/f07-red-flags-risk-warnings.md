---
name: SRS-07 Red Flags & Risk Warnings
description: Bảng mã bị loại theo 4 vòng + warning badges với confidence penalty (5/10/15pp, cap 20pp). Phase 2.
type: feature
module: SRS-07
prd_fr: FR-05
phase: 2
---

# F07 — Red Flags & Risk Warnings

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f06-top-mua-explainability.md](f06-top-mua-explainability.md), [f08-stock-detail.md](f08-stock-detail.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (WarningBadge, ExcludedReason, CONFIDENCE_PENALTY_*)

## UC-07-01: Display Excluded Stocks

### Structure
Bảng mã bị loại, grouped by vòng lọc

| Column | Description |
|---|---|
| Ticker + Name | Mã bị loại |
| Excluded At | Vòng 1/2/3/4 |
| Reason | Lý do cụ thể (e.g. "D/E = 4.5 ≥ 4") |
| Badge | Red flag type |

## UC-07-02: Display Warning Badges on Scored Stocks

### Warning Badge Trigger Rules

| Badge | Trigger | Severity | Confidence Penalty |
|---|---|---|---|
| "Đòn bẩy cao" | D/E ≥ 3 AND D/E < 4 | Minor | -5pp |
| "Dòng tiền âm" | OCF < 0 | Major | contributes to total |
| "Rủi ro pháp lý" | Legal Risk Score ≥ 4 | Major | contributes to total |
| "Tồn kho cao" | Inventory/TA > 60% | Minor | -5pp |

### Confidence Penalty Calculation

```
total_badges = count of triggered badges
if total_badges == 1: penalty = 5
elif total_badges == 2: penalty = 10
elif total_badges >= 3: penalty = 15
penalty = min(penalty, 20)  // cap

adjusted_confidence = original_confidence - penalty
```

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-07-01 | Mã D/E=3.2 hiển thị badge "Đòn bẩy", D/E=4.1 bị loại Vòng 1 (không badge) |
| AC-07-02 | Mã có 2 badges → confidence giảm chính xác 10pp |
| AC-07-03 | Mã có 4 badges → confidence giảm 15pp (không phải 20pp vì 3+ = 15) |
| AC-07-04 | Cap penalty = 20pp. Confidence không bao giờ < 0% |
| AC-07-05 | Badges hiển thị ở Top MUA + Stock Detail + PDF |
