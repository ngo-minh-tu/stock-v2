---
name: Appendix — Enums & Constants Registry
description: Single source of truth cho mọi enum (Recommendation, EntrySignal, Sentiment, NewsSource, WarningBadge, Theme, RunStatus, ExcludedReason), 38 scoring feature IDs, raw indicators và constants. Mọi file f* tham chiếu.
type: global
source: SRS §26
version: v1.2 LOCKED (post-prototype reconciliation)
---

# G03 — Enum & Constant Registry

> Parent: [00-system-overview.md](00-system-overview.md)
> Đây là **single source of truth**. Mọi feature file (f01-f17) tham chiếu định nghĩa tại đây thay vì redefine.

## Changelog

- **v1.2 (2026-05-09, cluster 1 reconciliation):** Bổ sung §F note giải thích quan hệ giữa schema enums (`Theme` 3-value + `ClassicMode`) và CSS resolved `data-theme` attribute (4-value: classic-dark, classic-light, light, oled). Bổ sung §L Frontend Constants (STORAGE_KEYS, MOCK_JWT_PREFIX).
- **v1.3 (2026-05-09, cluster 2 reconciliation):** ➕ Bổ sung §M VND Unit Conventions — track inconsistency giữa current_price (ngàn đồng) / market_cap (tỷ đồng) / allocation_amount (đồng) / total_capital (đồng). Cluster 3 sẽ chốt thống nhất hoặc thêm format helpers.
- **v1.3 (2026-05-09, cluster 3 reconciliation):** ➕ Bổ sung §N Reason Codes (15 enum strict whitelist GUARD-02). §M cluster 3 update: chưa thống nhất unit, defer sang cluster 4 (Price Board) khi join với portfolio.
- **v1.4 (2026-05-09, cluster 4 reconciliation):** ❌ §M REMOVED "Cluster 4 task: chốt 1 trong 3 hướng" → ✅ REPLACED bằng decision: **multi-unit + helpers** (Option C — giữ convention từng field, defer single-unit sweep sang backend phase). ➕ ADDED §O TtckColor enum + `priceColor()` pure function signature. ➕ ADDED §P NEWLY_LISTED_INDEXES fixture anchor (deterministic 6 mã).

## A. Recommendation Enum

```
enum Recommendation { MUA, GIỮ, BÁN }
```

## B. Entry Signal Enum (priority order)

```
enum EntrySignal {
  INSUFFICIENT_DATA       // Priority 1
  NO_ENTRY                // Priority 2
  BUY_STRONG              // Priority 3
  BUY_NOW                 // Priority 4
  WAIT_FOR_BREAKOUT       // Priority 5
  WAIT_FOR_PULLBACK       // Priority 6
  WAIT_FOR_CONFIRMATION   // Priority 7
}
```

Used by: [f03-entry-point-logic.md](f03-entry-point-logic.md)

## C. Sentiment Enum

```
enum SentimentLabel { POSITIVE, NEUTRAL, NEGATIVE }
// sentiment_score: float, range [-1.0, +1.0]
```

Used by: [f10-news-sentiment.md](f10-news-sentiment.md), [f02-feature-engineering.md](f02-feature-engineering.md) (S01)

## D. News Source Enum

```
enum NewsSource { CAFEF, VNEXPRESS, VIETSTOCK, BATDONGSAN, THANHNIEN }
```

Used by: [f10-news-sentiment.md](f10-news-sentiment.md), [f15-settings.md](f15-settings.md)

## E. Warning Badge Enum

```
enum WarningBadge {
  HIGH_LEVERAGE  = "Đòn bẩy cao"     // D/E >= 3 AND < 4
  NEGATIVE_OCF   = "Dòng tiền âm"    // OCF < 0
  LEGAL_RISK     = "Rủi ro pháp lý"  // Legal Risk Score >= 4
  HIGH_INVENTORY = "Tồn kho cao"     // Inventory/TA > 60%
}
```

Used by: [f07-red-flags-risk-warnings.md](f07-red-flags-risk-warnings.md), [f06-top-mua-explainability.md](f06-top-mua-explainability.md), [f08-stock-detail.md](f08-stock-detail.md)

## F. Theme Enum

```
enum Theme        { CLASSIC, LIGHT, OLED }
enum ClassicMode  { DARK, LIGHT }
enum Language     { VIE, ENG }
```

Used by: [f15-settings.md](f15-settings.md), [f17-theme-i18n.md](f17-theme-i18n.md)

> **Schema vs CSS resolved attribute:** Settings store dùng cặp `(theme, classic_mode)` (3 × 2 = 6 combinations, nhưng `classic_mode` chỉ có ý nghĩa khi `theme=CLASSIC`). CSS render qua attribute `data-theme` trên `<html>` resolve thành **4 giá trị duy nhất**: `classic-dark`, `classic-light`, `light`, `oled` (xem [f17 §UC-17-01](f17-theme-i18n.md) cho mapping rule). Không serialize/transmit `data-theme` qua API — chỉ là client-side CSS resolution.

## G. Run Status Enum

```
enum RunStatus { RUNNING, COMPLETED, FAILED }
```

Used by: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f12-run-history-backtest.md](f12-run-history-backtest.md)

## H. Excluded Reason Enum

```
enum ExcludedReason {
  DELISTED          = "Hủy niêm yết"
  SUSPENDED         = "Tạm ngừng GD"
  CWX_WARNING       = "Cảnh báo/kiểm soát"
  HIGH_DE           = "D/E >= 4"
  LOW_ROE           = "ROE < -20%"
  CONSECUTIVE_LOSS  = "Lỗ >= 3 quý"
  AUDIT_ISSUE       = "Kiểm toán từ chối"
  PENNY_STOCK       = "Giá < 15.000đ"
  LOW_LIQUIDITY     = "KLGD < 300K"
  INSUFFICIENT_DATA = "Thiếu dữ liệu"
  NEWLY_LISTED      = "Mới niêm yết < 4 quý"
}
```

Used by: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f07-red-flags-risk-warnings.md](f07-red-flags-risk-warnings.md)

## I. 38 Scoring Feature IDs

```
Fundamental (16): F01-F16
Technical   (9):  T01-T09
Macro       (5):  M01-M05
Real Estate (5):  R01-R05
Sentiment   (3):  S01-S03
Total:           38
```

Chi tiết tính toán + missing data rules: [f02-feature-engineering.md](f02-feature-engineering.md)

## J. Raw Indicators (Entry Logic only, NOT scoring features)

```
SMA20, SMA50, SMA200
EMA12, EMA26
Bollinger_Upper, Bollinger_Lower
MACD_Signal_Line
Support_Zone, Resistance_Zone
```

Used by: [f03-entry-point-logic.md](f03-entry-point-logic.md)

## K. Constants

```
STOP_LOSS_PCT                   = 0.10   // -10%
CONFIDENCE_PENALTY_1_BADGE      = 5      // percentage points
CONFIDENCE_PENALTY_2_BADGES     = 10
CONFIDENCE_PENALTY_3PLUS        = 15
CONFIDENCE_PENALTY_CAP          = 20
DEFAULT_BUY_THRESHOLD           = 75
DEFAULT_HOLD_MIN_THRESHOLD      = 45
VNSTOCK_DELAY_SECONDS           = 0.5
VNSTOCK_CACHE_HOURS             = 24
BACKTEST_HOLD_RETURN_MIN        = -7     // %
BACKTEST_HOLD_RETURN_MAX        = 12     // %
BACKTEST_SELL_UNDERPERFORM      = 5      // % vs VN-Index
```

## L. Frontend Constants (Cluster 1)

```
STORAGE_KEYS = {
  TOKEN:        "token",         // JWT session token (single-user MVP)
  THEME:        "theme",         // Theme enum value
  CLASSIC_MODE: "classic_mode",  // ClassicMode enum value
  LOCALE:       "locale"         // Language enum value
}

MOCK_JWT_PREFIX = "mock_jwt_"   // Prototype-only: prefix cho fake token MSW handler sinh; MVP backend dùng JWT thực
```

Used by: prototype `lib/constants.ts`, MVP frontend mirror.

## M. VND Unit Conventions (chốt cluster 4)

> [v1.4] Cluster 4 chốt **Option C — multi-unit + helpers**. Lý do chọn: prototype reuse convention từng field qua cluster 1-4, đổi sang single-unit sẽ touch >20 chỗ (PriceCell/Stock Detail header/Risk Panel/Portfolio P&L/Run summary). Single-unit defer sang backend phase khi schema migration. Frontend hiện dùng helper `formatPrice` / `formatVnd` qua `lib/format.ts`.

| Field | Convention | Example | Helper |
|---|---|---|---|
| `result.static.current_price` | **ngàn đồng** | `32.5` = 32.500 VND | `formatPrice(value, 'thousand')` |
| `result.risk.stop_loss_price` | **ngàn đồng** | `29.25` = 29.250 VND | `formatPrice(value, 'thousand')` |
| `latest_price.{open,high,low,close,reference,ceiling,floor}` | **ngàn đồng** | (đồng bộ với current_price) | PriceCell tự format |
| `holding.buy_price` (cluster 5) | **ngàn đồng** | `35.5` = 35.500 VND | `formatPrice(value, 'thousand')` |
| `result.static.market_cap` | **tỷ đồng** | `15.2` = 15.2 tỷ VND | `formatVnd(value, 'billion')` |
| `result.risk.allocation_amount` | **đồng** | `150_000_000` | `formatVnd(value, 'raw')` |
| `summary.total_capital` | **đồng** | `500_000_000` | `formatVnd(value, 'raw')` |
| `latest_price.volume` | **raw shares** | `1_250_000` | `formatVolume(value)` (1K=1.000 shares, 1M=1.000.000) |

**Backend phase task (post-MVP):** thống nhất single unit trong DB schema (đề xuất raw đồng cho price + market_cap để khớp tiêu chuẩn FastAPI / vnstock); frontend tiếp tục multi-unit display qua format helpers.

## N. Reason Codes — Entry Signal Explanation (Cluster 3)

> [v1.3] 15 enum strict whitelist. **GUARD-02**: token unknown bị bỏ, KHÔNG cho user/LLM tạo reason text tự do.

```
enum ReasonCode {
  // Bullish
  VALUATION_ATTRACTIVE       = "Định giá hấp dẫn"
  BULLISH_TREND              = "Xu hướng tăng"
  NAV_DISCOUNT               = "Chiết khấu NAV"
  STRONG_FUNDAMENTAL         = "Cơ bản mạnh"
  MACD_BULLISH_CROSS         = "MACD cắt lên"

  // Wait / mixed
  NEAR_RESISTANCE            = "Gần kháng cự"
  NEAR_SUPPORT               = "Gần hỗ trợ"
  OVERBOUGHT                 = "Quá mua"
  OVERSOLD                   = "Quá bán"
  WEAK_TREND                 = "Xu hướng yếu"
  AWAIT_BREAKOUT             = "Chờ vượt kháng cự"
  AWAIT_PULLBACK             = "Chờ điều chỉnh"
  AWAIT_CONFIRMATION         = "Chờ xác nhận"

  // Negative
  NEGATIVE_RECOMMENDATION    = "Khuyến nghị GIỮ/BÁN"
  INSUFFICIENT_INDICATORS    = "Thiếu chỉ báo kỹ thuật"
}
```

**Format trong API:** `entry.reason_code` là string composed bằng `+`, e.g. `"VALUATION_ATTRACTIVE+BULLISH_TREND"`. Frontend split `+` → filter qua whitelist enum → render mỗi token thành chip i18n.

**Default per signal** (sinh tự động khi screening result không có explicit code) — xem [`prototype/src/mocks/data/reason-codes.ts`](../../prototype/src/mocks/data/reason-codes.ts) `DEFAULT_REASON_BY_SIGNAL` map.

Used by: [f03-entry-point-logic.md](f03-entry-point-logic.md) (output schema), [f08-stock-detail.md](f08-stock-detail.md) (EntrySignalPanel reason chips).

## O. TtckColor + priceColor() — TTCK 5-color Rule (Cluster 4)

> [v1.4] Pure function trong `lib/constants.ts`, source of truth cho PriceCell + Stock Detail header + Portfolio current price cell.

```ts
type TtckColor = 'ceil' | 'up' | 'ref' | 'down' | 'floor';

function priceColor(
  price: number,
  ceiling: number,
  floor: number,
  reference: number
): TtckColor {
  if (price >= ceiling) return 'ceil';   // ORDER MATTERS: ceiling/floor BEFORE up/down
  if (price <= floor)   return 'floor';
  if (price === reference) return 'ref';
  if (price > reference)   return 'up';
  return 'down';
}
```

**Token mapping** (xem [design.md §3.2](../design.md)):

| TtckColor | CSS variable |
|---|---|
| `ceil`  | `var(--ssi-ceil)` |
| `up`    | `var(--ssi-up)` |
| `ref`   | `var(--ssi-ref)` |
| `down`  | `var(--ssi-down)` |
| `floor` | `var(--ssi-floor)` |

**Quan trọng:** dùng `>=` / `<=` (KHÔNG `===` strict) cho ceiling/floor để robust với rounding 2dp (`32.50` vs `32.500001`). Float compare exact equal trên 2dp đôi khi sai.

Used by: [f05-price-board.md](f05-price-board.md), [f08-stock-detail.md](f08-stock-detail.md), [f11-portfolio-lite.md](f11-portfolio-lite.md).

## P. NEWLY_LISTED_INDEXES — Fixture Anchor (Cluster 4)

> [v1.4] Deterministic anchor đảm bảo AC-05-07 (filter "Mới niêm yết" cluster 4) luôn có ≥1 mã pass. KHÔNG random — đảm bảo reload luôn cùng kết quả.

```ts
const NEWLY_LISTED_INDEXES = new Set([5, 17, 31, 46, 58, 73]);
// 6 mã trong fixture 81 stock được tag `newly_listed=true`
```

Used by: [f05-price-board.md](f05-price-board.md) AC-05-07, prototype `mocks/data/price-board-fixture.ts`.

**Backend phase note:** field `newly_listed` đã có trong [TAD g03 Table 1 stocks](../tad/g03-database.md). Production sẽ tính qua first-listed-date < 4 quarters thay vì hardcode index — frontend KHÔNG cần đổi (chỉ đọc flag).
