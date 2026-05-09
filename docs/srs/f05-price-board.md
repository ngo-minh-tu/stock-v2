---
name: SRS-05 Price Board
description: Bảng giá đầy đủ ~81 mã với color-coding TTCK VN 5-color, sort/filter/search, deep-link Stock Detail. Phase 3.
type: feature
module: SRS-05
prd_fr: FR-03
phase: 3
version: v1.4 LOCKED (cluster 4 reconciliation)
---

# F05 — Price Board

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f08-stock-detail.md](f08-stock-detail.md) (deep-link target), [f11-portfolio-lite.md](f11-portfolio-lite.md) (reuse `LatestPrice` shape)
> Related — global: [g03](g03-appendix-enums-constants.md) §O (TtckColor + priceColor), §P (NEWLY_LISTED_INDEXES anchor)
> Related — tech: [TAD g02 §7](../tad/g02-api.md) endpoint shape

## Changelog

- **v1.4 (2026-05-09, cluster 4 reconciliation):** ❌ REMOVED 10-column table spec (AI Score + Khuyến nghị columns) — cluster 4 không hiển thị 2 cột này (Stock Detail + Top MUA mới là nơi hiển thị scoring). ❌ REMOVED hex hardcode `#0BDF39/#FF0017/#F23AFF/#FDFF12/#00C9FF` trong color rule → ✅ REPLACED bằng `var(--ssi-up/down/ceil/ref/floor)` CSS variable strings (theme-aware qua design.md §3.2). ❌ REMOVED AC-05-04 mơ hồ "Sort + filter hoạt động đồng thời" → ✅ REPLACED bằng AC cụ thể về search debounce, default sort, filter independence. ➕ ADDED 14-column table, PriceCell 2-mode pattern + anchor prop, 3 filter sections (Exchange chips multi / Sector dropdown / Newly-listed toggle), search debounce 200ms, ExchangeBadge integration với `--exchange-upcom` riêng cho UPCOM, `data-color-tag` attr cho a11y/QA, click ticker → Stock Detail không cần run_id (RunContext hydrate qua last completed run), pagination `limit=100` single-fetch (KHÔNG infinite scroll cho prices). AC-05-05..11 mới.

## UC-05-01: Display Full Price Board

### Preconditions

Whitelist ~81 mã loaded từ fixture. KHÔNG cần screening run đã chạy — Price Board độc lập với run state. Khi đã có run terminal, `current_price` từ run mới nhất ưu tiên hơn fixture fallback (đảm bảo Stock Detail header và Price Board cùng giá cho cùng 1 mã).

### Endpoint

`GET /api/stocks?limit=100&offset=0` — full snapshot 81 mã, single fetch (no pagination needed cho prototype scope ≤200 mã). Response shape xem [TAD g02 §7](../tad/g02-api.md).

### Layout

| Region | Content |
|---|---|
| Header | "Bảng giá" title + subtitle "X mã" (X = filtered count) |
| Filter row | 3 group: Exchange chips (multi) + Sector dropdown + Newly-listed toggle + Reset button + Search input |
| Table | TanStack Table v8, 14 cột, sticky header, font Roboto 11px (`text-2xs`), alternating row bg |

### Table Specification (TanStack Table v8, 14 columns)

| # | Column | Field | Format | Sortable | Cell mode |
|---|---|---|---|---|---|
| 1 | Ticker | `ticker` | Bold uppercase, click → Stock Detail | Yes | Plain link |
| 2 | Tên | `name` | String | Yes | Plain |
| 3 | Sàn | `exchange` | `<ExchangeBadge>` HOSE/HNX/UPCOM | Yes | Badge |
| 4 | Ngành | `sector` | String | Yes | Plain |
| 5 | TC (Tham chiếu) | `latest.reference` | 2dp | No | PriceCell static `ref` |
| 6 | Trần | `latest.ceiling` | 2dp | No | PriceCell static `ceil` |
| 7 | Sàn | `latest.floor` | 2dp | No | PriceCell static `floor` |
| 8 | Mở cửa | `latest.open` | 2dp | Yes | PriceCell static `ref` |
| 9 | Cao | `latest.high` | 2dp | Yes | PriceCell dynamic, anchor=high |
| 10 | Thấp | `latest.low` | 2dp | Yes | PriceCell dynamic, anchor=low |
| 11 | Khớp (Close) | `latest.close` | 2dp | Yes (default DESC) | PriceCell dynamic, anchor=close |
| 12 | ± | `latest.change` | ±2dp signed | Yes | PriceCell dynamic, anchor=close (color=close color, value=change) |
| 13 | %± | `latest.change_pct` | ±2dp% signed | Yes | PriceCell dynamic, anchor=close |
| 14 | KL (Volume) | `latest.volume` | K/M format (1K=1.000, 1M=1.000.000) | Yes | Plain neutral |

> Cột Mới (newly_listed flag) hiển thị qua small badge "Mới" cạnh Ticker khi `stock.newly_listed === true` — KHÔNG là cột riêng.

### PriceCell 2-mode pattern

Single component với type discriminated union:

```tsx
type PriceCellProps =
  | { mode: 'static'; fixedColor: TtckColor; value: number }
  | { mode: 'dynamic'; value: number; anchor: number;
      ceiling: number; floor: number; reference: number };
```

- **`static` mode** (cột Reference/Ceiling/Floor/Open): force token color, không apply 5-color rule.
- **`dynamic` mode** (cột High/Low/Close/Change/Change%): apply `priceColor()` rule với `anchor` để tách "value to display" khỏi "value to color against". Lý do: cột ± và %± hiển thị change number nhưng color phải khớp close.

### Color Rules — `priceColor(price, ceiling, floor, reference)` → TtckColor

| Condition | Token | Token CSS variable |
|---|---|---|
| `price >= ceiling` | `ceil` | `var(--ssi-ceil)` tím |
| `price <= floor` | `floor` | `var(--ssi-floor)` xanh dương |
| `price === reference` | `ref` | `var(--ssi-ref)` vàng |
| `price > reference` | `up` | `var(--ssi-up)` xanh lá |
| `price < reference` | `down` | `var(--ssi-down)` đỏ |

> **Order matters:** ceiling/floor BEFORE up/down để clamp đúng. Dùng `>=` / `<=` (KHÔNG `===` strict) để robust với rounding 2dp (32.50 vs 32.500001). Pure function trong [`g03 §O`](g03-appendix-enums-constants.md) — testable, importable, single source of truth cho PriceCell + Stock Detail header + Portfolio current price cell.

### Filters

| Filter | Type | Default | Behavior |
|---|---|---|---|
| Exchange | Multi-select chips (HOSE/HNX/UPCOM) | All selected | Click chip → toggle in/out; chip color match `<ExchangeBadge>` tone |
| Sector | Dropdown single-select | "Tất cả" | List unique sector từ fixture |
| Newly-listed | Toggle | Off | Khi on → chỉ hiện 6 mã có `newly_listed=true` (anchor `NEWLY_LISTED_INDEXES = {5,17,31,46,58,73}` — xem [g03 §P](g03-appendix-enums-constants.md)) |
| Search | Text input + debounce 200ms | empty | Match ticker hoặc name (case-insensitive contains) |
| Reset | Button | — | Khôi phục filter về default |

Search debounce **200ms qua `useEffect` + `setTimeout` cleanup**, KHÔNG dùng lodash. Single useEffect đủ.

### Default Sort

`[{ id: 'close', desc: true }]` — Close DESC. TanStack Table accept initial state này; sortable header click vẫn toggle bình thường.

### ExchangeBadge integration

Cột "Sàn" + filter chips dùng `<ExchangeBadge>` chung (giới thiệu cluster 3 cho Stock Detail header):

| Exchange | Color token |
|---|---|
| HOSE | `var(--exchange-hose)` = ssi-up green |
| HNX | `var(--exchange-hnx)` = ssi-floor blue |
| UPCOM | `var(--exchange-upcom)` (riêng — KHÔNG dùng `--ssi-ref` vì #fdff12 quá chói trên badge nhỏ ở OLED + classic-dark; xem [design.md §3.7](../design.md)) |

### Click ticker → Stock Detail

Navigate `/stock-detail?ticker={X}` (KHÔNG kèm `run_id`). Stock Detail page resolve run_id qua `RunContext.lastCompletedRunId` (mount-once hydrate `GET /api/runs?limit=1` — xem [TAD g01-runtime §4.5](../tad/g01-runtime.md), [f08 §UC-08-02](f08-stock-detail.md)). Nếu user chưa có run terminal nào → render "noRun" message thay vì error misleading.

### Theme awareness

Mọi cell color qua CSS variable string (`var(--ssi-*)`, `var(--color-theme-price-table-*)`) — browser resolve theo `[data-theme]` attribute, theme switch không cần re-render React (xem [design.md §6.5](../design.md)).

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-05-01 | Hiển thị tất cả 81 mã trong fixture (no pagination needed cho ≤200 mã); subtitle "X mã" cập nhật theo filter |
| AC-05-02 | `priceColor()` apply 5-color rule đúng: ceiling/floor BEFORE up/down clamp với `>=`/`<=`; ít nhất 1 row mỗi loại {ceil/up/ref/down/floor} hiện diện qua anchor `seed%12 → ceiling`, `seed%13 → floor`, `seed%17 → reference` |
| AC-05-03 | Click ticker → navigate `/stock-detail?ticker={X}` (không kèm run_id); Stock Detail tự resolve qua `lastCompletedRunId` hoặc render "noRun" message |
| AC-05-04 | Default sort `[close DESC]`; click bất kỳ sortable header → toggle ASC/DESC; search filter independent với sort/exchange/sector filter (3 nguồn AND) |
| AC-05-05 | Search input debounce 200ms; clear input → table reset full set |
| AC-05-06 | Filter Exchange chips multi-select; click chip để toggle; ít nhất 1 chip phải selected (không cho phép empty all) |
| AC-05-07 | Filter "Mới niêm yết" toggle on → chỉ 6 mã pass (anchor `NEWLY_LISTED_INDEXES`); off → full set |
| AC-05-08 | UPCOM badge dùng `--exchange-upcom` riêng (KHÔNG `--ssi-ref`); test trên OLED + classic-dark không chói |
| AC-05-09 | `current_price` ưu tiên lấy từ `runsStore.latest()` nếu có run terminal; fallback fixture seed nếu chưa run lần nào → cùng số tiền với Stock Detail header cho cùng ticker |
| AC-05-10 | Theme switch (4 themes) → bảng đổi tone (background row + 5 TTCK colors + ExchangeBadge) qua CSS var, render < 200ms |
| AC-05-11 | DOM row có `data-color-tag={closeColor}` attribute (cho a11y screen reader + QA test selector) |
