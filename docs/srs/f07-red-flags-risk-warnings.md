---
name: SRS-07 Red Flags & Risk Warnings
description: Bảng mã bị loại theo 4 vòng + warning badges với confidence penalty (5/10/15pp, cap 20pp). Phase 2.
type: feature
module: SRS-07
prd_fr: FR-05
phase: 2
version: v1.3 LOCKED (cluster 2 reconciliation)
---

# F07 — Red Flags & Risk Warnings

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f06-top-mua-explainability.md](f06-top-mua-explainability.md), [f08-stock-detail.md](f08-stock-detail.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (WarningBadge, ExcludedReason, CONFIDENCE_PENALTY_*)

## Changelog

- **v1.3 (2026-05-09, cluster 2 reconciliation):** ➕ Bổ sung UC-07-03 Page Layout 2-Section (Section A: Excluded stocks với filter round + reason; Section B: Warning badges trên scored stocks với filter badge type). AC-07-06..09 mới.

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

## UC-07-03: Red Flags Page Layout (2-Section)

> [v1.3] Chốt từ cluster 2 prototype

`/red-flags` page render 2 section riêng biệt (cùng 1 page, scroll-based), KHÔNG tab/accordion.

### Section A: "Mã bị loại" (Excluded Stocks)

Bảng TanStack Table list mã bị loại qua 4 vòng filter (xem [f01 §UC-01-01 Step 3-6](f01-core-screening-pipeline.md)).

| # | Column | Source | Filter |
|---|---|---|---|
| 1 | Ticker | `excluded.ticker` | Search box |
| 2 | Tên | `excluded.name` | (qua ticker) |
| 3 | Excluded At | `excluded.excluded_round` (1-4) | **Multi-select dropdown** (round 1-4) |
| 4 | Reason | `excluded.reason_text` (e.g. "D/E = 4.5 ≥ 4") | — |
| 5 | Reason Code | `excluded.reason_code` (ExcludedReason enum) | **Multi-select dropdown** (11 enum values từ [g03 §H](g03-appendix-enums-constants.md)) |

**Invariant:** mã `MOCK_INSUFFICIENT` (test fixture) **luôn xuất hiện** trong Section A — verify cluster 2 mock data hoạt động.

### Section B: "Cảnh báo" (Warning Badges trên Scored Stocks)

Bảng list các mã đã được scored (qua filter) nhưng có ≥1 warning badge.

| # | Column | Source | Filter |
|---|---|---|---|
| 1 | Ticker | `result.ticker` | Search box |
| 2 | Recommendation | `result.recommendation` | Multi-select (MUA/GIỮ/BÁN) |
| 3 | AI Score | `result.ai_score` | Range |
| 4 | Confidence (after penalty) | `result.confidence` (đã trừ penalty) | — |
| 5 | Badges | `result.risk.warning_badges[]` (1-4 badges) | **Multi-select** (4 enum từ [g03 §E](g03-appendix-enums-constants.md): HIGH_LEVERAGE / NEGATIVE_OCF / LEGAL_RISK / HIGH_INVENTORY) |
| 6 | Confidence penalty | computed: `confidence_raw - confidence` | — |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-07-06 | Page hiển thị 2 section riêng biệt, scroll-based (không tab); Section A trên, Section B dưới |
| AC-07-07 | Section A filter round (1-4) + reason_code (multi-select) hoạt động đồng thời (AND logic) |
| AC-07-08 | Section B chỉ hiển thị mã có `warning_badges.length ≥ 1`; mã KHÔNG có badge không xuất hiện |
| AC-07-09 | `MOCK_INSUFFICIENT` luôn ở Section A của mọi run (test fixture invariant); nếu không xuất hiện → bug data layer |
