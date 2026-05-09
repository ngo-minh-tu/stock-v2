---
name: SRS-02 Feature Engineering
description: Tính 38 scoring features (Fundamental 16, Technical 9, Macro 5, RE 5, Sentiment 3) cho mỗi mã đã qua 4 vòng lọc. Phase 1.
type: feature
module: SRS-02
prd_fr: FR-01
phase: 1
---

# F02 — Feature Engineering

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f03-entry-point-logic.md](f03-entry-point-logic.md), [f10-news-sentiment.md](f10-news-sentiment.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (38 Feature IDs, Sentiment enum)

## UC-02-01: Calculate 38 Scoring Features for a Stock

### Preconditions
- Mã đã qua 4 vòng lọc
- vnstock data available (live hoặc cache)

### Input
Raw data từ vnstock: BCTC, giá lịch sử, khối lượng

### Processing Rules

#### Nhóm 1 — Fundamental (F01-F16)

| Feature | Calculation | Missing Data Rule |
|---|---|---|
| F01 P/E | price / EPS. Nếu EPS ≤ 0 → P/E = null | Impute = sector median |
| F02 P/B | price / BVPS | Impute = sector median |
| F03 ROE | net_income / equity × 100 | Impute = 0 (trung lập) |
| F04 ROA | net_income / total_assets × 100 | Impute = 0 |
| F05 EPS | net_income / shares_outstanding | REQUIRED — thiếu thì INSUFFICIENT_DATA |
| F06 D/E | total_debt / equity | REQUIRED |
| F07 Net Margin | net_income / revenue × 100 | Impute = 0 |
| F08 Revenue Growth YoY | (rev_current - rev_prev) / rev_prev × 100 | Impute = 0 |
| F09 Profit Growth YoY | (profit_current - profit_prev) / profit_prev × 100 | Impute = 0 |
| F10 OCF | operating_cash_flow from BCTC | Impute = 0, set warning |
| F11 Current Ratio | current_assets / current_liabilities | Impute = 1.0 |
| F12 Advances | "Người mua trả tiền trước" from BCTC | Impute = 0 |
| F13 OCF/NI | OCF / net_income. Nếu NI ≤ 0 → null | Impute = 0.5 |
| F14 Inv/TA | inventory / total_assets × 100 | Impute = sector median |
| F15 Inv Turnover | COGS / avg_inventory | Impute = sector median |
| F16 Inv vs Rev Growth | inv_growth_rate - rev_growth_rate | Impute = 0 |

#### Nhóm 2 — Technical (T01-T09)

| Feature | Calculation from Raw Indicators | Missing Data Rule |
|---|---|---|
| T01 MA Trend Score | Score 0-100: +33 nếu price>SMA20, +33 nếu price>SMA50, +34 nếu price>SMA200 | REQUIRED (cần ≥6M giá) |
| T02 EMA Momentum | (EMA12 - EMA26) / EMA26 × 100 | REQUIRED |
| T03 RSI(14) | Standard RSI 14 periods | REQUIRED |
| T04 MACD Histogram | MACD_line - signal_line | REQUIRED |
| T05 Bollinger Position | (price - BB_lower) / (BB_upper - BB_lower) | REQUIRED |
| T06 Avg Volume 20D | mean(volume, 20 sessions) | REQUIRED |
| T07 Price Return 1M | (price_now - price_1m_ago) / price_1m_ago × 100 | Impute = 0 |
| T08 Price Return 3M | (price_now - price_3m_ago) / price_3m_ago × 100 | Impute = 0 |
| T09 Price Return 6M | (price_now - price_6m_ago) / price_6m_ago × 100 | Impute = 0 |

#### Nhóm 3 — Macro (M01-M05)

| Feature | Source | Missing Data Rule |
|---|---|---|
| M01 Lãi suất NHNN | SBV crawl / tin tức | Dùng giá trị gần nhất known |
| M02 Tín dụng BĐS growth | SBV/GSO | Dùng giá trị gần nhất known |
| M03 CPI | GSO | Dùng giá trị gần nhất known |
| M04 FDI vào BĐS | GSO/tin tức | Dùng giá trị gần nhất known |
| M05 VN-Index | vnstock | REQUIRED |

#### Nhóm 4 — Real Estate Specific (R01-R05)

| Feature | Source | Missing Data Rule |
|---|---|---|
| R01 Quỹ đất (ha) | Crawl BCTN | Impute = sector median, giảm confidence |
| R02 Số dự án | Crawl BCTN/tin | Impute = sector median |
| R03 NAV/cp | Tính từ BCTC | Impute = BVPS × 1.2 |
| R04 NAV Discount | (NAV - price) / NAV | Phụ thuộc R03 |
| R05 Legal Risk (1-5) | AI phân tích tin | Impute = 3 (trung lập) |

#### Nhóm 5 — Sentiment (S01-S03)

| Feature | Source | Missing Data Rule |
|---|---|---|
| S01 Sentiment Score | AI NLP, -1 to +1 (GUARD-08) | Impute = 0.0 (NEUTRAL) |
| S02 News Count 30D | Crawl | Impute = 0 |
| S03 Insider Net | CafeF/vnstock | Impute = 0 |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-02-01 | Output chính xác 38 features cho mỗi mã scored |
| AC-02-02 | Không feature nào ngoài danh sách F01-S03 (GUARD-01) |
| AC-02-03 | Feature REQUIRED mà thiếu → mã bị flag INSUFFICIENT_DATA |
| AC-02-04 | Feature imputable mà thiếu → dùng impute value, set feature_availability flag |
| AC-02-05 | Tất cả T01-T09 là composite scores, KHÔNG phải raw indicator values |
| AC-02-06 | T01 MA Trend Score output range 0-100 |
| AC-02-07 | T05 Bollinger Position output range 0-1 |
| AC-02-08 | S01 output range -1.0 to +1.0 |
