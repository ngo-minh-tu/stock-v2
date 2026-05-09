---
name: SRS-03 Entry Point Logic
description: Deterministic rules engine quyết định entry signal (BUY_STRONG, BUY_NOW, WAIT_*, NO_ENTRY, INSUFFICIENT_DATA) theo priority order. Phase 1.
type: feature
module: SRS-03
prd_fr: FR-01
phase: 1
version: v1.3 LOCKED (cluster 3 reconciliation)
---

# F03 — Entry Point Logic

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md), [f02-feature-engineering.md](f02-feature-engineering.md), [f08-stock-detail.md](f08-stock-detail.md)
> Related — global: [g03](g03-appendix-enums-constants.md) (EntrySignal enum, ReasonCodes, Raw Indicators)

## Changelog

- **v1.3 (2026-05-09, cluster 3 reconciliation):** + AC-03-09 Step 2 enforcement (rec≠MUA → NO_ENTRY) — cluster 2 mock chưa enforce, cluster 3 fix bằng `decideEntrySignal(ticker, score, rec, badges)`. + note frontend prototype anchor override pattern cho 7-enum coverage.

## UC-03-01: Determine Entry Signal for a Stock

### Preconditions
- Mã đã có ai_score + recommendation
- Raw indicators đã tính (SMA20/50/200, EMA12/26, RSI, MACD, Bollinger, S/R zones)

### Input

```
{
  recommendation: MUA | GIỮ | BÁN,
  ai_score: number,
  confidence: number,
  upside_pct: number,
  nav_discount_pct: number,    // (NAV - price) / NAV × 100
  rsi: number,
  price: number,
  ma20: number,
  macd_histogram: number,
  macd_signal_cross: boolean,  // MACD vừa cắt lên signal
  bollinger_upper: number,
  bollinger_lower: number,
  nearest_support: number,
  nearest_resistance: number,
  technical_features_available: int  // số raw indicators có sẵn
}
```

### Processing — Priority Order (First Match Wins)

```
STEP 1: if technical_features_available < (total_required - 1):
          → return INSUFFICIENT_DATA

STEP 2: if recommendation != MUA:
          → return NO_ENTRY

STEP 3: if recommendation == MUA AND rsi > 70 AND price > bollinger_upper:
          → return NO_ENTRY (overbought)

STEP 4: if recommendation == MUA
         AND upside_pct >= 20
         AND nav_discount_pct >= 20  (giá < 80% NAV)
         AND rsi < 60
         AND price > ma20
         AND rsi <= 70:
          → return BUY_STRONG

STEP 5: if recommendation == MUA
         AND upside_pct >= 10
         AND (nav_discount_pct >= 10 OR (price > ma20 AND macd_histogram > 0)):
          → return BUY_NOW

STEP 6: if recommendation == MUA
         AND price >= nearest_resistance * 0.97  (gần resistance ≤3%)
         AND rsi >= 50 AND rsi <= 65
         AND price < nearest_resistance:
          → return WAIT_FOR_BREAKOUT

STEP 7: if recommendation == MUA
         AND rsi > 60:
          → return WAIT_FOR_PULLBACK

STEP 8: if recommendation == MUA
         AND macd_signal_cross == false
         AND abs(price - ma20) / ma20 < 0.03:  (giá gần MA20 ≤3%)
          → return WAIT_FOR_CONFIRMATION

STEP 9: (fallback for MUA mã không match bất kỳ rule nào)
          → return BUY_NOW
```

### Output

```
{
  signal: EntrySignalEnum,
  support_zone: number,
  resistance_zone: number,
  reason_code: string,         // e.g. "VALUATION_ATTRACTIVE+BULLISH_TREND"
  raw_indicators_used: string[] // audit trail
}
```

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-03-01 | Thiếu ≥2 raw indicators → INSUFFICIENT_DATA, không bao giờ output signal khác |
| AC-03-02 | recommendation != MUA → luôn NO_ENTRY |
| AC-03-03 | RSI>70 + price>BB_upper + MUA → NO_ENTRY (overbought override) |
| AC-03-04 | BUY_STRONG yêu cầu TẤT CẢ 5 conditions đồng thời true |
| AC-03-05 | Priority order nghiêm ngặt: nếu match Step 4 thì KHÔNG check Step 5-8 |
| AC-03-06 | Mọi output có reason_code + raw_indicators_used (audit) |
| AC-03-07 | Step 9 fallback đảm bảo không bao giờ return null cho mã MUA |

### Test Fixtures

| Fixture | Input Summary | Expected |
|---|---|---|
| TF-03-01 | MUA, upside 25%, NAV disc 30%, RSI 52, price>MA20 | BUY_STRONG |
| TF-03-02 | MUA, upside 15%, RSI 55, price>MA20, MACD>0 | BUY_NOW |
| TF-03-03 | MUA, RSI 72, price>BB_upper | NO_ENTRY |
| TF-03-04 | GIỮ, any | NO_ENTRY |
| TF-03-05 | MUA, RSI 63, upside 12% | WAIT_FOR_PULLBACK |
| TF-03-06 | MUA, gần resistance 1.5%, RSI 58 | WAIT_FOR_BREAKOUT |
| TF-03-07 | MUA, MACD chưa cross, price ≈ MA20 | WAIT_FOR_CONFIRMATION |
| TF-03-08 | Thiếu 3 raw indicators | INSUFFICIENT_DATA |

| AC-03-09 | Bất kỳ implementation (backend hoặc frontend mock) MUST enforce Step 2 — rec≠MUA luôn → NO_ENTRY, không bao giờ trả WAIT_* hoặc BUY_* cho mã GIỮ/BÁN |

### Frontend Prototype Anchor Pattern

> [v1.3] Cluster 3 — `prototype/src/mocks/data/run-compute.ts`

Để demo 7 enum coverage trong UI, prototype dùng `decideEntrySignal(ticker, score, rec, badges)` với 2 cơ chế:
1. **Anchor overrides** (per ticker, hardcoded): `VHM=BUY_STRONG, KDH=BUY_NOW (+1 badge HIGH_INVENTORY), NLG=WAIT_FOR_BREAKOUT, DXG=WAIT_FOR_PULLBACK, PDR=WAIT_FOR_CONFIRMATION` — ghi đè rule logic để demo có ticker mỗi enum
2. **Recommendation gate** (Step 2): mã không phải MUA → trả NO_ENTRY ngay, không vào logic Step 3-9

MOCK_HOLD/SELL → NO_ENTRY qua gate; MOCK_INSUFFICIENT excluded round 4 → INSUFFICIENT_DATA via 404 fallback (test fixture limitation, xem cluster-3-summary §9).

Backend MVP KHÔNG có anchor overrides — chỉ implement rule logic theo Step 1-9 priority order.
