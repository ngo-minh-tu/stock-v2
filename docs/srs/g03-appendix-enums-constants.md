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

## M. VND Unit Conventions (Cluster 2 - Cluster 4 TBD)

> [v1.3] Cluster 2 phát hiện convention không nhất quán. Cluster 3 reuse mà chưa thống nhất → defer sang cluster 4 (Price Board) khi join với portfolio buộc fix.

| Field | Current convention | Example |
|---|---|---|
| `result.static.current_price` | **ngàn đồng** | `32.5` = 32.500 VND |
| `result.risk.stop_loss_price` | **ngàn đồng** | `29.25` = 29.250 VND |
| `result.static.market_cap` | **tỷ đồng** | `15.2` = 15.2 tỷ VND |
| `result.risk.allocation_amount` | **đồng** | `150_000_000` |
| `summary.total_capital` | **đồng** | `500_000_000` |

**Cluster 4 task:** chốt 1 trong 3 hướng — (a) all raw đồng, (b) all ngàn đồng, (c) multi-unit + helpers `formatPrice/formatVnd`.

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
