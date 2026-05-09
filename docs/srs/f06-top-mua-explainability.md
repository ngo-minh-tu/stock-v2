---
name: SRS-06 Top MUA & Explainability
description: Danh sách mã MUA với 3-5 lý do traceable đến feature ID, expandable để xem stop loss + allocation + S/R. Phase 2.
type: feature
module: SRS-06
prd_fr: FR-04 + FR-08
phase: 2
---

# F06 — Top MUA & Explainability

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f02-feature-engineering.md](f02-feature-engineering.md), [f07-red-flags-risk-warnings.md](f07-red-flags-risk-warnings.md), [f09-risk-management.md](f09-risk-management.md)
> Related — global: [g02](g02-non-functional-requirements.md) (AC-NF-08, AC-NF-10), [g03](g03-appendix-enums-constants.md) (Recommendation, EntrySignal, WarningBadge)

## UC-06-01: Display Top MUA List

### Preconditions
Screening run có ≥1 mã recommendation = MUA

### List Item Structure

```
┌─────────────────────────────────────────────────┐
│ KDH  MUA  Score: 82  Tin cậy: 77%  ▲+18.5%    │
│ Entry: BUY_NOW                                   │
│                                                   │
│ Lý do: ROE cao (16.8%), D/E thấp (0.8),         │
│ doanh thu +25%, chiết khấu NAV 17%,             │
│ tín hiệu kỹ thuật tích cực.                     │
│                                                   │
│ [⚠ Tồn kho cao]                        [Expand ▼]│
├─────────────────────────────────────────────────┤
│ (Expand area)                                     │
│ Stop Loss: 29.250 (-10% từ 32.500)              │
│ Phân bổ: 150.000.000 VNĐ (30% of 500M)         │
│ Support: 30.500 | Resistance: 36.000             │
└─────────────────────────────────────────────────┘
```

### Explainability Rules (GUARD-02)

Tóm tắt 3-5 lý do PHẢI được sinh từ:

| Lý do type | Source | Ví dụ |
|---|---|---|
| Fundamental strength | F03 ROE, F06 D/E, F10 OCF, F08/F09 growth | "ROE cao (16.8%)" |
| Valuation attractive | R04 NAV discount, F01 P/E, F02 P/B | "Chiết khấu NAV 17%" |
| Technical positive | T01 MA Trend, T03 RSI, T04 MACD | "Tín hiệu kỹ thuật tích cực" |
| Sentiment positive | S01 score, S02 news count | "Sentiment tích cực (0.6)" |
| Risk flag | Warning badges | "⚠ Tồn kho cao" |

Lý do KHÔNG ĐƯỢC generate tự do bằng LLM. Mỗi lý do map đến ≥1 scoring feature hoặc risk flag cụ thể.

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-06-01 | Mỗi mã MUA có 3-5 lý do |
| AC-06-02 | Mỗi lý do traceable đến feature ID hoặc risk flag |
| AC-06-03 | Warning badges hiển thị trước expand |
| AC-06-04 | Expand hiển thị stop loss + allocation + S/R zones |
| AC-06-05 | ≥90% mã MUA có ≥3 lý do hợp lệ (Success Metric) |
