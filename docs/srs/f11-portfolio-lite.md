---
name: SRS-11 Portfolio Lite
description: CRUD danh mục (ticker, quantity, buy_price, buy_date) + tính lãi/lỗ + stop loss + UI 4 KPI + table 12 cột + modal validation. Phase 3.
type: feature
module: SRS-11
prd_fr: FR-09
phase: 3
version: v1.4 LOCKED (cluster 5 reconciliation)
---

# F11 — Portfolio Lite

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f05-price-board.md](f05-price-board.md) (current_price snapshot reuse), [f08-stock-detail.md](f08-stock-detail.md) (deep-link target), [f09-risk-management.md](f09-risk-management.md)
> Related — global: [g01](g01-global-errors-and-validation.md) (ticker/quantity/price validation), [g03](g03-appendix-enums-constants.md) §K (STOP_LOSS_PCT), §M (VND units — buy_price ngàn đồng), §S (MOCK_FIXTURE_TODAY)
> Related — tech: [TAD g02 §8](../tad/g02-api.md) (response shapes)

## Changelog

- **v1.4 (2026-05-09, cluster 5 reconciliation):** ➕ ADDED UC-11-02 Frontend UI (4 KPI cards, PortfolioTable 12 cột, HoldingFormModal, DeleteHoldingModal, empty state, in-memory reset each reload, format VND fr-FR, PnL color signed). Detailed validation 6 client-side rules + server fallback. Click ticker → Stock Detail không cần run_id (RunContext fallback). AC-11-07..15.

## UC-11-01: CRUD Portfolio Holdings (Backend Data Model)

### Data Model

```
{
  holding_id: auto,
  ticker: string (FK to stocks),
  quantity: int (> 0),
  buy_price: float (> 0, ngàn đồng),
  buy_date: date (YYYY-MM-DD, ≤ TODAY),
  notes: string (optional),
  created_at: datetime,
  updated_at: datetime
}
```

### Derived Fields (calculated, not stored)

```
current_price     = latest price từ /api/stocks snapshot (ưu tiên runsStore.latest, fallback fixture seed)
market_value      = quantity × current_price
cost_basis        = quantity × buy_price
unrealized_pnl    = market_value - cost_basis
unrealized_pnl_pct = unrealized_pnl / cost_basis × 100
stop_loss_price   = buy_price × (1 - STOP_LOSS_PCT) = buy_price × 0.90
```

### Acceptance Criteria — Backend

| AC ID | Criteria |
|---|---|
| AC-11-01 | CRUD: tạo (POST), đọc (GET list), sửa (PUT), xóa (DELETE 200+envelope) holding |
| AC-11-02 | quantity ≤ 0 hoặc không phải số nguyên → 400 ERR-11-02 "Số lượng phải là số nguyên dương" |
| AC-11-03 | buy_price ≤ 0 hoặc không phải số → 400 ERR-11-03 "Giá mua phải là số dương" |
| AC-11-04 | ticker không trong whitelist (`STOCK_FIXTURE` mock / `stocks` table backend) → 400 ERR-11-04 "Mã {X} không có trong whitelist" |
| AC-11-05 | Lãi/lỗ tính chính xác theo formula derived fields trên |
| AC-11-06 | Stop loss reference dùng `buy_price` (KHÔNG phải `current_price`) — STOP_LOSS_PCT = 0.10 (xem g03 §K) |

---

## UC-11-02: Frontend Portfolio UI

### Page Layout

```
┌──────────────────────────────────────────────┐
│ Header: "Danh mục đầu tư" + button "+ Thêm" │
├──────────────────────────────────────────────┤
│ 4 KPI cards (grid cols-4)                    │
├──────────────────────────────────────────────┤
│ PortfolioTable 12 cột                        │
└──────────────────────────────────────────────┘

Empty state: "Chưa có mã nào trong danh mục" + button "Thêm mã đầu tiên"
```

### KPI Cards (4 cards)

| Card | Value | Format | Color |
|---|---|---|---|
| Total cost | Σ `cost_basis` | `formatVnd(value, 'raw')` đồng | text-primary |
| Current value | Σ `market_value` | `formatVnd(value, 'raw')` đồng | text-primary |
| P&L | Σ `unrealized_pnl` (signed) | `formatVnd` + hint dòng dưới = `pnl_pct` (signed %) | `var(--ssi-up)` nếu ≥0, `var(--ssi-down)` nếu <0, `var(--ssi-stable)` nếu =0 |
| Holdings count | `holdings.length` | Integer | text-primary |

### PortfolioTable (TanStack Table v8, 12 columns)

| # | Column | Field | Format | Sortable |
|---|---|---|---|---|
| 1 | Ticker | `ticker` | Bold uppercase, click → `/stock-detail?ticker=X` (no run_id, RunContext fallback) | Yes |
| 2 | Tên | `name` | Plain | Yes |
| 3 | Sàn | `exchange` | `<ExchangeBadge>` | Yes |
| 4 | SL (Quantity) | `quantity` | Integer, fr-FR locale (`toLocaleString('fr-FR')`) | Yes |
| 5 | Giá mua | `buy_price` | 2dp ngàn đồng | Yes |
| 6 | Giá hiện tại | `current_price` | `<PriceCell>` mode dynamic với ceiling/floor/reference từ price-board snapshot | Yes |
| 7 | Tổng vốn | `cost_basis` | fr-FR locale, đồng | Yes |
| 8 | Giá trị hiện tại | `market_value` | fr-FR locale, đồng | Yes |
| 9 | Lãi/lỗ | `unrealized_pnl` | signed +/-, color signed (ssi-up/down/stable) | Yes |
| 10 | Lãi/lỗ % | `unrealized_pnl_pct` | signed %, color signed | Yes (default DESC) |
| 11 | Ngày mua | `buy_date` | DD/MM/YYYY | Yes |
| 12 | Hành động | — | 2 icon: Pencil (edit) + Trash2 (delete, ssi-down tone) | No |

**Default sort:** `[{ id: 'unrealized_pnl_pct', desc: true }]` — lãi cao nhất trước.

### HoldingFormModal (add/edit shared component)

- **Trigger:** click "+ Thêm mã" (header) hoặc Pencil icon (row).
- **Layout:** modal centered, max-w-md, ESC close, click backdrop close.
- **Auto-focus:** ticker input khi add; save button khi edit.
- **Edit mode:** ticker input `disabled` (không cho đổi mã, chỉ qty/price/date/notes).
- **Datalist:** `<input list="ticker-list">` với autocomplete suggestions từ STOCK_FIXTURE — max 8 suggestion (ticker + name).
- **Save:** POST /api/portfolio (add) hoặc PUT /api/portfolio/{id} (edit) → toast success → close modal → reload list.

### Client-side Validation (6 rules trước khi submit)

| Rule | Trigger | Message |
|---|---|---|
| 1. Ticker required | empty | "Vui lòng nhập mã" |
| 2. Ticker in whitelist | not in STOCK_FIXTURE | "Mã {X} không có trong whitelist" |
| 3. Quantity > 0 integer | ≤0 hoặc decimal | "Số lượng phải là số nguyên dương" |
| 4. Buy price > 0 | ≤0 hoặc NaN | "Giá mua phải là số dương" |
| 5. Buy date format | not YYYY-MM-DD | "Ngày mua không hợp lệ" |
| 6. Buy date ≤ TODAY | future date | "Ngày mua không thể ở tương lai" |

Date input có `max={TODAY}` (= [g03 §S MOCK_FIXTURE_TODAY](g03-appendix-enums-constants.md) = `'2026-05-07'`) để picker UI ngăn user chọn future. Server fallback validate cùng rules.

### DeleteHoldingModal

- Confirm modal với interpolation `<ticker>` trong body.
- ssi-down (`var(--ssi-down)`) red button label "Xóa".
- ESC close. Cancel button. After delete → toast "Đã xóa {ticker}" + remove row.

### In-memory Reset Behavior

Each page reload (F5) → in-memory store reset, KHÔNG persist qua localStorage. User test CRUD độc lập từng phiên prototype. **Backend phase:** persist qua `portfolio` table (xem [g03 Table 10](../tad/g03-database.md)).

### Acceptance Criteria — Frontend

| AC ID | Criteria |
|---|---|
| AC-11-07 | 4 KPI cards render đúng formula; P&L color signed (ssi-up nếu ≥0, ssi-down nếu <0, stable nếu =0) |
| AC-11-08 | PortfolioTable 12 cột; default sort `[unrealized_pnl_pct DESC]`; sortable header click toggle |
| AC-11-09 | Click ticker → navigate `/stock-detail?ticker={X}` không kèm run_id; Stock Detail tự resolve qua RunContext |
| AC-11-10 | Cột "Giá hiện tại" dùng PriceCell mode dynamic với ceiling/floor/reference từ price-board snapshot — TTCK 5-color rule áp dụng |
| AC-11-11 | HoldingFormModal: 6 client-side validation rules trigger trước submit; auto-focus ticker (add) hoặc save (edit); ESC + backdrop close; edit mode disable ticker input |
| AC-11-12 | Datalist autocomplete max 8 suggestion từ STOCK_FIXTURE |
| AC-11-13 | DeleteHoldingModal confirm với interpolation `<ticker>`; ssi-down red button; ESC close |
| AC-11-14 | Empty state ("Chưa có mã nào") khi `holdings.length === 0`; CTA "Thêm mã đầu tiên" mở cùng modal |
| AC-11-15 | In-memory reset each reload (no localStorage); format VND `toLocaleString('fr-FR')` (1.234.567 đồng); date DD/MM/YYYY |
