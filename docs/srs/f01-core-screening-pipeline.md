---
name: SRS-01 Core Screening Pipeline
description: Pipeline sàng lọc thủ công 81 mã BĐS qua 4 vòng lọc + AI scoring + entry + risk + persist + Telegram. Phase 1.
type: feature
module: SRS-01
prd_fr: FR-01
phase: 1
---

# F01 — Core Screening Pipeline

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f02-feature-engineering.md](f02-feature-engineering.md), [f03-entry-point-logic.md](f03-entry-point-logic.md), [f09-risk-management.md](f09-risk-management.md), [f14-telegram-bot.md](f14-telegram-bot.md)
> Related — global: [g01](g01-global-errors-and-validation.md) (ERR-01-*), [g03](g03-appendix-enums-constants.md) (RunStatus, ExcludedReason)

## UC-01-01: Execute Manual Screening Run

### Preconditions
- PO đã đăng nhập (Auth passed)
- vnstock accessible HOẶC cache 24h available
- Settings đã có ngưỡng MUA/GIỮ/BÁN (mặc định 75/45)

### Input
- `total_capital`: số tiền VNĐ (nhập thủ công, ≥ 0)
- `thresholds`: {buy: 75, hold_min: 45} (từ Settings hoặc mặc định)
- `enabled_news_sources`: list nguồn tin đang bật (từ Settings)

### Main Flow

```
Step 1: Load whitelist ~81 mã BĐS từ DB
Step 2: Fetch data từ vnstock (delay 0.5s/call)
  → Nếu lỗi: dùng cache 24h, set flag data_from_cache = true
Step 3: Vòng 1 — Red Flags filter
  → Output: excluded_stocks[] + newly_listed_warnings[]
Step 4: Vòng 2 — Price Floor filter (< 15.000đ)
  → Output: excluded_stocks[] updated
Step 5: Vòng 3 — Liquidity filter (< 300K cp/phiên)
  → Output: excluded_stocks[] updated
Step 6: Vòng 4 — Data Completeness filter
  → Output: excluded_stocks[] updated + insufficient_data_warnings[]
Step 7: Feature Engineering (f02) cho mã còn lại
  → Output: feature_matrix[ticker][38 scoring features]
Step 8: AI Scoring (XGBoost hoặc Baseline)
  → Output: scores[ticker] = {ai_score, recommendation, confidence, reasons[]}
Step 9: AI Price Prediction (LSTM hoặc Baseline)
  → Output: predictions[ticker] = {target_price_3m, upside_pct, target_date}
Step 10: Entry Point Logic (f03)
  → Output: entries[ticker] = {signal_enum, support, resistance}
Step 11: Risk Management (f09)
  → Output: risks[ticker] = {stop_loss_price, allocation_amount, warning_badges[]}
Step 12: Save run to DB
  → screening_runs record + screening_results per ticker
Step 13: Nếu Telegram bật → gửi summary (f14)
  → Lỗi Telegram không block run
Step 14: Return full results to frontend
```

### Output Object

```
{
  run_id: string,
  run_at: datetime,
  model_version: string,
  settings_version: string,
  data_from_cache: boolean,
  total_input: int,          // ~81
  after_round_1: int,
  after_round_2: int,
  after_round_3: int,
  after_round_4: int,
  scored_count: int,
  buy_count: int,
  hold_count: int,
  sell_count: int,
  results: ScreeningResult[],
  excluded: ExcludedStock[],
  warnings: Warning[],
  capital_allocation: Allocation[],   // nếu total_capital > 0
  telegram_sent: boolean,
  telegram_error: string | null
}
```

### Acceptance Criteria

| AC ID | Criteria | Auto-testable |
|---|---|---|
| AC-01-01 | Run hoàn thành trong < 5 phút cho 81 mã | Yes |
| AC-01-02 | Mỗi run lưu model_version + settings_version | Yes |
| AC-01-03 | total_input = after_round_1 + excluded_round_1 | Yes |
| AC-01-04 | Mã excluded không có trong results[] | Yes |
| AC-01-05 | Nếu vnstock lỗi + không có cache → run fail gracefully với ERR-01-01 | Yes |
| AC-01-06 | Nếu vnstock lỗi + có cache → run succeed với data_from_cache = true | Yes |
| AC-01-07 | Telegram lỗi không block run (telegram_sent=false, telegram_error populated) | Yes |
| AC-01-08 | Mã mới <4Q BCTC xuất hiện trong warnings[], không trong results[] | Yes |
| AC-01-09 | Tất cả mã trong results[] có ai_score trong range 0-100 | Yes |
| AC-01-10 | buy_count + hold_count + sell_count = scored_count | Yes |

### Error States

| Error ID | Condition | Handling |
|---|---|---|
| ERR-01-01 | vnstock lỗi + không có cache | Return error message, run_status = FAILED |
| ERR-01-02 | 0 mã qua 4 vòng lọc | Return empty results, run_status = COMPLETED, scored_count = 0 |
| ERR-01-03 | AI Engine crash | Fallback to baseline, log error, continue run |
