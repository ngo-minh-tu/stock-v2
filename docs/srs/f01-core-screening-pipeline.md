---
name: SRS-01 Core Screening Pipeline
description: Pipeline sàng lọc thủ công 81 mã BĐS qua 4 vòng lọc + AI scoring + entry + risk + persist + Telegram. Phase 1.
type: feature
module: SRS-01
prd_fr: FR-01
phase: 1
version: v1.3 LOCKED (cluster 2 reconciliation)
---

# F01 — Core Screening Pipeline

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f02-feature-engineering.md](f02-feature-engineering.md), [f03-entry-point-logic.md](f03-entry-point-logic.md), [f09-risk-management.md](f09-risk-management.md), [f14-telegram-bot.md](f14-telegram-bot.md)
> Related — global: [g01](g01-global-errors-and-validation.md) (ERR-01-*), [g03](g03-appendix-enums-constants.md) (RunStatus, ExcludedReason)

## Changelog

- **v1.3 (2026-05-09, cluster 2 reconciliation):** ➕ Bổ sung UC-01-02 Frontend Run Lifecycle UI (RunButton, CapitalModal, RunStatusCard, Toast + auto-reload via lastCompletedRunId). AC-01-11..18 mới về run UX.

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

## UC-01-02: Frontend Run Lifecycle UI

> [v1.3] Chốt từ cluster 2 prototype

### Components

| Component | Vị trí | Behavior |
|---|---|---|
| `RunButton` | Header (bên trái Theme/Locale switcher) | Primary button "Chạy" → mở `CapitalModal` |
| `CapitalModal` | Modal overlay | Input `total_capital` (default 500.000.000 VNĐ, format `fr-FR` với separator `.`); checkbox "Bỏ qua phân bổ vốn"; ESC + click-outside close. Submit → `POST /api/run` với `outcome` từ MockOutcomeContext (prototype only) |
| `RunStatusCard` | Sticky dưới `<Header />`, mọi page sau login | Status badge (RunStatus enum) + step text (`current_step`) + progress bar (`progress_percent`). Cancel button **disabled** ở MVP (TAD g01: cancel chưa hỗ trợ) |
| `RunSelector` | Dropdown trong Dashboard, TopMUA, RedFlags | Top 10 run gần nhất theo `run_at` DESC, label `dd/MM/yy HH:mm — N mã` |
| `Toast` | Top-right viewport | Auto-fire khi run terminal: success 3s, warnings 3s, failed 4s, conflict (immediate) |

### Run Lifecycle Flow (frontend)

```
1. User click RunButton → CapitalModal opens
2. User submit total_capital → POST /api/run
   ├─ 202 Accepted: runId saved → close modal → start polling
   └─ 409 Conflict: toast warning "Đang có tác vụ chạy" → modal stays
3. Polling /api/runs/{id}/status mỗi 2 giây (TAD g01 §2.2)
   └─ Cập nhật RunStatusCard real-time
4. Khi status terminal (COMPLETED | COMPLETED_WITH_WARNINGS | FAILED):
   ├─ Stop polling
   ├─ Fire toast với tone tương ứng (success/warning/error)
   ├─ Set lastCompletedRunId = runId
   └─ Auto-clear RunStatusCard sau toast duration
5. Dashboard/TopMUA/RedFlags listen lastCompletedRunId → tự re-fetch dữ liệu
```

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-01-11 | RunButton xuất hiện trong Header trên mọi page sau login (kể cả Settings) |
| AC-01-12 | CapitalModal default 500M VNĐ, format `fr-FR` (`500.000.000`); checkbox skip-allocation lưu state local trong modal |
| AC-01-13 | Khi run đang chạy (status ∈ {PENDING, CHECKING_DATA, SCREENING, SCORING}): RunStatusCard sticky, click RunButton lại → 409 toast (server-side conflict) |
| AC-01-14 | Polling interval = 2s (chuẩn TAD g01 §2.2). Auto-stop khi terminal |
| AC-01-15 | Toast tone match outcome: COMPLETED → success xanh, COMPLETED_WITH_WARNINGS → warning cam, FAILED → error đỏ. Auto-dismiss: success/warnings 3s, failed 4s |
| AC-01-16 | `lastCompletedRunId` broadcast xuống Dashboard/TopMUA/RedFlags pages → mọi page tự reload dữ liệu mới (no manual F5) |
| AC-01-17 | Reload trang khi run đang chạy → RunStatusCard biến mất (state in-memory không persist). Backend khi ship sẽ resume qua `GET /api/runs/{id}/status` |
| AC-01-18 | Cancel button trên RunStatusCard **disabled** ở MVP (TAD g01: chưa hỗ trợ cancel) |
