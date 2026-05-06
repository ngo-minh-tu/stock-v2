---
name: Appendix — Enums & Constants Registry
description: Single source of truth cho mọi enum (Recommendation, EntrySignal, Sentiment, NewsSource, WarningBadge, Theme, RunStatus, ExcludedReason), 38 scoring feature IDs, raw indicators và constants. Mọi file f* tham chiếu.
type: global
source: SRS §26
---

# G03 — Enum & Constant Registry

> Parent: [00-system-overview.md](00-system-overview.md)
> Đây là **single source of truth**. Mọi feature file (f01-f17) tham chiếu định nghĩa tại đây thay vì redefine.

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
