---
name: SRS-06 Top MUA & Explainability
description: TanStack Table v8 mã MUA với 3-5 lý do traceable đến feature ID, expandable row để xem stop loss + allocation + S/R. Phase 2.
type: feature
module: SRS-06
prd_fr: FR-04 + FR-08
phase: 2
version: v1.3 LOCKED (cluster 2 reconciliation)
---

# F06 — Top MUA & Explainability

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f02-feature-engineering.md](f02-feature-engineering.md), [f07-red-flags-risk-warnings.md](f07-red-flags-risk-warnings.md), [f09-risk-management.md](f09-risk-management.md)
> Related — global: [g02](g02-non-functional-requirements.md) (AC-NF-08, AC-NF-10), [g03](g03-appendix-enums-constants.md) (Recommendation, EntrySignal, WarningBadge)

## Changelog

- **v1.3 (2026-05-09, cluster 2 reconciliation):** ❌ REMOVED ASCII single-card mockup (wireframe pattern không match prototype) → ✅ REPLACED bằng TanStack Table v8 column spec + expand row spec. ➕ ADDED sort default + filter + search + deep-link. AC-06-06..10 mới.

## UC-06-01: Display Top MUA List

### Preconditions
Screening run có ≥1 mã recommendation = MUA

### Implementation: TanStack Table v8

> [v1.3] Replaces wireframe ASCII mockup. Headless table với React-controlled markup, row expansion, sort, filter.

### Column Specification

| # | Column | Source | Format | Sort | Filter |
|---|---|---|---|---|---|
| 1 | Ticker | `result.ticker` | Bold uppercase | Asc/Desc | Search box (case-insensitive substring) |
| 2 | Tên công ty | `result.name` | Plain | Asc/Desc | (qua ticker search) |
| 3 | Khuyến nghị | `result.recommendation` | `<RecommendationBadge>` MUA pill xanh | — | Fixed = MUA only |
| 4 | AI Score | `result.ai_score` | Integer 0-100, color theo recommendation | **Default Desc** | Range slider (cluster 2+) |
| 5 | Confidence | `result.confidence` | `XX%` | Asc/Desc | — |
| 6 | Upside | `result.upside_pct` | `+XX.X%` color theo dấu | Asc/Desc | — |
| 7 | Entry Signal | `result.entry.signal` | `<EntrySignalChip>` 7 enum theo 3 tone | — | Multi-select |
| 8 | Warnings | `result.risk.warning_badges[]` | `<WarningBadge>` icon AlertTriangle, max 4 | — | Multi-select |
| 9 | Action | — | "Xem chi tiết" button | — | — |

### Expand Row Content

Click row hoặc icon `▶` → expand row hiển thị (theo thứ tự):

1. **3-5 lý do** (`result.reasons[]`) — text + traceability `(F03, ROE: 16.8)` (xem rules dưới)
2. **Buy zone** — `result.entry.support_zone` đến hiện giá `result.static.current_price`
3. **Stop Loss** — `result.risk.stop_loss_price` (`-10%` từ entry, format VNĐ)
4. **Phân bổ vốn** — `result.risk.allocation_amount` VNĐ (`X%` of `total_capital` từ run)
5. **Support / Resistance** — `result.entry.support_zone` / `result.entry.resistance_zone` (format VNĐ)
6. **Action button:** "Xem chi tiết →" → navigate `/stock-detail?run_id=X&ticker=Y`

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
| AC-06-03 | Warning badges hiển thị trong column riêng (col #8) trước khi expand |
| AC-06-04 | Expand row hiển thị stop loss + allocation + S/R zones theo thứ tự đã spec |
| AC-06-05 | ≥90% mã MUA có ≥3 lý do hợp lệ (Success Metric) |
| AC-06-06 | Default sort = AI Score DESC; click column header để đổi sort/order |
| AC-06-07 | Search ticker (col #1) → instant filter, case-insensitive substring match |
| AC-06-08 | Click row hoặc icon `▶` → expand; click lại → collapse. Multiple rows expand đồng thời được phép |
| AC-06-09 | Click "Xem chi tiết →" → navigate `/stock-detail?run_id={current_run_id}&ticker={row.ticker}` (deep-link shape KHÔNG được đổi — Stock Detail page rely vào shape này) |
| AC-06-10 | Filter recommendation = MUA fixed (table không hiển thị GIỮ/BÁN); GIỮ/BÁN xem ở [f07 Red Flags](f07-red-flags-risk-warnings.md) hoặc [f08 Stock Detail](f08-stock-detail.md) |
