---
id: c02
title: Feature Engineering Service + Normalization Spec (38 features)
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§11, §12)
---

# c02 — Feature Engineering & Normalization

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f02-feature-engineering.md](../srs/f02-feature-engineering.md)
>
> Related — global: [g03-database.md](g03-database.md) (reads `stock_prices`, `financial_reports`, `macro_data`), [g04-cache.md](g04-cache.md) (source-level freshness gates feature recomputation)

---

## 1. Feature Engineering Service

Tính 38 scoring features + raw indicators từ DB/cache data. Xem SRS-02 cho chi tiết calculation + missing data rules.

Technical features T01-T09 là **composite scores** tính từ raw indicators:

| Feature | Composite From |
|---|---|
| T01 MA Trend Score | SMA20, SMA50, SMA200 → 0-100 |
| T02 EMA Momentum | EMA12, EMA26 → % |
| T03 RSI(14) | Price history → 0-100 |
| T04 MACD Histogram | MACD line - Signal |
| T05 Bollinger Position | Price, BB_upper, BB_lower → 0-1 |
| T06 Avg Volume 20D | Volume history → number |
| T07-T09 Price Returns | Price history → % |

---

## 2. Feature Normalization Spec (Baseline)

> [v1.1 MUST-FIX 8] Normalization table cho Baseline Scoring Engine

Baseline scoring: mỗi feature normalize 0-100, nhân weight nhóm, sum = AI Score.

### 2.1 Normalization Formula

```
if direction == "higher_better":
    score = clamp((value - bad) / (good - bad) * 100, 0, 100)
elif direction == "lower_better":
    score = clamp((bad - value) / (bad - good) * 100, 0, 100)
```

### 2.2 Normalization Table (38 features)

**Fundamental (F01-F16):**

| ID | Direction | Good | Bad | Notes |
|---|---|---|---|---|
| F01 P/E | Lower | 8 | 25 | P/E ≤ 0 → score 0 |
| F02 P/B | Lower | 1.0 | 3.0 | |
| F03 ROE | Higher | 20% | 0% | |
| F04 ROA | Higher | 8% | 0% | |
| F05 EPS | Higher | 5000 | 0 | VND/share |
| F06 D/E | Lower | 0.5 | 3.0 | |
| F07 Net Margin | Higher | 20% | 0% | |
| F08 Rev Growth | Higher | 30% | -10% | |
| F09 Profit Growth | Higher | 30% | -20% | |
| F10 OCF | Higher | 5000 (tỷ) | 0 | Positive = good |
| F11 Current Ratio | Higher | 2.0 | 0.8 | |
| F12 Advances | Higher | Growing (+20%) | Declining (-10%) | YoY change % |
| F13 OCF/NI | Higher | 1.0 | 0 | |
| F14 Inv/TA | Lower | 20% | 70% | |
| F15 Inv Turnover | Higher | 0.8 | 0.1 | |
| F16 Inv vs Rev Growth | Lower | -10% (rev > inv) | +20% (inv > rev) | inv_growth - rev_growth |

**Technical (T01-T09):**

| ID | Direction | Good | Bad |
|---|---|---|---|
| T01 MA Trend | Higher | 100 | 0 | Already 0-100 |
| T02 EMA Momentum | Higher | 5% | -5% |
| T03 RSI | Neutral | 50 (center) | <30 or >70 | Score = 100 - abs(rsi-50)*2 |
| T04 MACD Hist | Higher | 2.0 | -2.0 |
| T05 Bollinger Pos | Neutral | 0.5 (center) | 0 or 1 | Score = 100 - abs(pos-0.5)*200 |
| T06 Avg Volume | Higher | 2M | 100K |
| T07 Return 1M | Higher | 15% | -15% |
| T08 Return 3M | Higher | 25% | -20% |
| T09 Return 6M | Higher | 40% | -30% |

**Macro (M01-M05):**

| ID | Direction | Good | Bad | Notes |
|---|---|---|---|---|
| M01 Interest Rate | Lower | 4% | 8% | Thấp = tốt cho BĐS |
| M02 Credit Growth | Higher | 15% | 0% | |
| M03 CPI | Lower | 2% | 6% | Lạm phát thấp = tốt |
| M04 FDI | Higher | 5B USD | 1B USD | /năm |
| M05 VN-Index | Higher | 1400 | 900 | |

**Real Estate (R01-R05):**

| ID | Direction | Good | Bad |
|---|---|---|---|
| R01 Land Bank | Higher | 5000 ha | 100 ha |
| R02 Projects | Higher | 8 | 1 |
| R03 NAV | Higher | 50000 | 10000 | VND/share |
| R04 NAV Discount | Higher | 40% | -10% | (NAV-price)/NAV |
| R05 Legal Risk | Lower | 1 | 5 | 1=clean, 5=severe |

**Sentiment (S01-S03):**

| ID | Direction | Good | Bad |
|---|---|---|---|
| S01 Sentiment | Higher | 0.8 | -0.8 |
| S02 News Count | Higher | 20 | 0 | 30 days |
| S03 Insider Net | Higher | Positive (net buy) | Negative (net sell) |
