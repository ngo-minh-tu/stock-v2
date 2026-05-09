---
name: SRS-12 Run History & Backtest
description: Danh sách runs (table 11 cột + 3 KPI) + so sánh 2 runs (4 sections panel) + backtest (modal + 2-stage polling + result card). Phase 3 + 4.
type: feature
module: SRS-12
prd_fr: FR-10
phase: 3 + 4
version: v1.4 LOCKED (cluster 5 reconciliation)
---

# F12 — Run History & Backtest

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f01-core-screening-pipeline.md](f01-core-screening-pipeline.md)
> Related — global: [g03](g03-appendix-enums-constants.md) §G (RunStatus), §K (BACKTEST_HOLD_RETURN_*, BACKTEST_SELL_UNDERPERFORM), §Q (REC_RANK), §R (SCORE_DISTRIBUTION_BUCKETS)
> Related — tech: [TAD g02 §8](../tad/g02-api.md) (response shapes)

## Changelog

- **v1.4 (2026-05-09, cluster 5 reconciliation):** ❌ REMOVED UC-12-02 old compare schema `{ added_to_buy, removed_from_buy, score_changes, new_warnings, resolved_warnings }` → ✅ REPLACED bằng prototype shape `{ summary_diff, recommendation_changes, new_entries, removed, score_distribution }` (cluster 5 chose prompt §4.3 over old SRS for richer compare UX). ❌ REMOVED UC-12-01 list display 6-col stub → ✅ REPLACED bằng 11-col detailed spec. ❌ REMOVED AC-12-01 mơ hồ "Compare hiển thị mã thay đổi khuyến nghị" → ✅ REPLACED bằng AC cụ thể. ➕ ADDED 3 KPI cards (Total runs / Last run hover absolute / Avg accuracy backtest), MiniBars 3-bar pattern, Compare button A/B label, 7 historical seed runs + 5 new RunSummary fields (model_version, settings_version, duration_seconds, warnings_count, avg_score), DeleteRunModal, 4-branch compare toggle UX, ComparePanel 4 sections detailed (CompareSummary positiveIsGood, RecommendationChangesTable row tint, NewRemovedSection 2-col, ScoreHistogram 6 buckets), BacktestModal date cross-validation, 2-stage polling pattern + 1.5s timing, BacktestResultCard 4 metric cards (accuracy threshold ≥60% green/red), BacktestRoiChart 2-series Recharts, BacktestDetailTable error DESC. AC-12-07..18.

## UC-12-01: View Run History

### Page Layout

```
┌──────────────────────────────────────────────┐
│ Header: "Lịch sử chạy" + button "Run Backtest" │
├──────────────────────────────────────────────┤
│ 3 KPI cards                                   │
├──────────────────────────────────────────────┤
│ [Run History Table 11 cols]   [Compare Panel] │  ≥1280px: 2-col
│                                                │  <1280px: stack
├──────────────────────────────────────────────┤
│ Backtest progress / result section (inline)   │
└──────────────────────────────────────────────┘
```

### KPI Cards (3 cards)

| Card | Value | Format | Hint |
|---|---|---|---|
| Total runs | `runs.length` | Integer | — |
| Last run | `runs[0].run_at` relative time ("3 giờ trước") | i18n keys | Tooltip on hover: absolute `DD/MM/YYYY HH:mm` |
| Avg accuracy backtest | `lastBacktest.accuracy * 100` | `XX.X%` hoặc `"—"` nếu `lastAccuracyPct === null` | Khi null: "Chạy backtest để xem" |

### RunHistoryTable (TanStack Table v8, 11 columns)

| # | Column | Field | Format | Sortable |
|---|---|---|---|---|
| 1 | Run ID | `run_id` | Truncate `run_seed_3` (full) hoặc `run_17…9999` (long ID, prefix 6 + ellipsis + suffix 4) | Yes |
| 2 | Thời gian | `run_at` | `DD/MM/YY HH:mm` | Yes (default DESC) |
| 3 | Trạng thái | `status` | Outlined badge với màu enum (RUNNING amber / COMPLETED green / COMPLETED_WITH_WARNINGS amber / FAILED red) | Yes |
| 4 | Tổng scored | `scored_count` | Integer | Yes |
| 5 | MUA/GIỮ/BÁN | `buy_count`, `hold_count`, `sell_count` | `<MiniBars>` 3-bar SVG-less (3 div fill width-proportional) + 3 số đếm | No |
| 6 | Cảnh báo | `warnings_count` | Badge `{n}` nếu >0; `"—"` nếu =0 | Yes |
| 7 | Model | `model_version` | Plain text (`baseline_v1` / `baseline_v2`) | Yes |
| 8 | Settings | `settings_version` | Integer (1 / 2) | Yes |
| 9 | Avg score | `avg_score` | 1dp | Yes |
| 10 | Duration | `duration_seconds` | `mm:ss` format | Yes |
| 11 | Hành động | — | 4 icon: ↗ View (→ Dashboard với run_id), ⇆ Compare (toggle A/B label visual when selected), 📥 Export PDF (cluster 6), 🗑 Delete | No |

**Compare button visual:**
- Default: `⇆` icon.
- When this run is selected as A: chip "A" + crimson border.
- When this run is selected as B: chip "B" + ssi-info border.

**Default sort:** `[{ id: 'run_at', desc: true }]` — newest first.

### 7 Historical Seed Runs (cluster 5 expansion)

`runs-store.ts` `SEED_SPECS` define 7 historical seed runs với mix:
- `daysAgo`: 1, 3, 6, 10, 14, 21, 28 (trải đều last 30 days)
- `model_version`: idx 0-2 = `baseline_v1`, idx 3-6 = `baseline_v2`
- `settings_version`: tương ứng 1 / 2
- `total_capital`: 300M-750M variation
- `duration_seconds`: 13-24s variation
- Outcome: 5 success / 2 warnings (idx 1, 4)

New runs từ cluster 2 RunButton tự động dùng `baseline_v2` + settings 2 (production model). Cluster 6 sẽ wire model_version + settings_version từ Settings UI.

### 5 New RunSummary Fields (cluster 5 additive)

| Field | Type | Source |
|---|---|---|
| `model_version` | string | seed spec / runsStore.start() default `baseline_v2` |
| `settings_version` | int | seed spec / runsStore default 2 |
| `duration_seconds` | float | `started_at_ms` tracking; live cho active runs (`now - started_at_ms`); recalc khi terminal |
| `warnings_count` | int | derived từ `warnings_json.length` hoặc seed spec |
| `avg_score` | float | `mean(ai_score)` trên scored results |

**Compatibility:** RunSelector (cluster 2) chỉ đọc field cũ → KHÔNG bị ảnh hưởng. `runs-store.summary()` populate cả old + new fields.

### DeleteRunModal

- Confirm modal pattern y hệt DeleteHoldingModal (xem [f11 §UC-11-02](f11-portfolio-lite.md)) nhưng có warning paragraph: "Hành động này không thể hoàn tác. Toàn bộ dữ liệu run + scored results sẽ bị xóa vĩnh viễn."
- DELETE `/api/runs/{id}` → 200+envelope (không 204; xem [TAD g02 §8](../tad/g02-api.md)) → `runsStore.delete(run_id)` cancel timers + remove from order/runs Map.

### Acceptance Criteria — Run History

| AC ID | Criteria |
|---|---|
| AC-12-07 | 3 KPI cards render: Total runs / Last run với hover absolute tooltip / Avg accuracy với null fallback `"—"` |
| AC-12-08 | RunHistoryTable 11 cột; default sort `[run_at DESC]`; status badge màu theo enum (4 màu); MiniBars 3-bar width-proportional |
| AC-12-09 | Run ID truncate: short IDs (`run_seed_3`) hiện đầy đủ; long IDs (>14 char) truncate `prefix6…suffix4` |
| AC-12-10 | View action → navigate `/?run_id={id}` (Dashboard load run đó); Export action → trigger PDF download (cluster 6); Delete action → DeleteRunModal confirm |
| AC-12-11 | 7 historical seed runs hiện diện sau reload; mix model_v1/v2 + settings 1/2; outcome 5 success / 2 warnings |
| AC-12-12 | DELETE `/api/runs/{id}` trả 200 với envelope `{success: true, data: { deleted: true }}` (KHÔNG 204) — xem [TAD g02 §8](../tad/g02-api.md) rationale |

## UC-12-02: Compare 2 Runs

### Compare State (page-level)

`compareA`, `compareB` local state. **4-branch toggle handler** khi user click Compare icon trên row:
1. Click run đang là A → clear A, shift B → A nếu có B (UX "remove A, promote B").
2. Click run đang là B → clear B (chỉ thay đổi B).
3. Click run mới khi A rỗng → set A.
4. Click run mới khi A có sẵn → set B.

**Validation:** ngăn chọn cùng 1 run làm A và B (handler return early). Server-side cũng validate `run_a !== run_b` → 400.

### CompareResponse Schema (prototype)

```ts
type CompareResponse = {
  summary_diff: {
    scored: { a: number, b: number, delta: number },
    buy_count: { a: number, b: number, delta: number },
    hold_count: { a: number, b: number, delta: number },
    sell_count: { a: number, b: number, delta: number },
    avg_score: { a: number, b: number, delta: number },
    duration_seconds: { a: number, b: number, delta: number }
  };
  recommendation_changes: Array<{
    ticker: string;
    name: string;
    rec_a: 'MUA' | 'GIỮ' | 'BÁN';
    rec_b: 'MUA' | 'GIỮ' | 'BÁN';
    score_a: number;
    score_b: number;
    direction: 'upgrade' | 'downgrade';
  }>;
  new_entries: Array<{ ticker, name, rec_b, score_b }>;     // mã ở B nhưng không ở A
  removed:     Array<{ ticker, name, rec_a, score_a }>;     // mã ở A nhưng không ở B
  score_distribution: {
    buckets: ['<30', '30-45', '45-60', '60-75', '75-90', '≥90'],
    a_counts: number[],   // 6 numbers
    b_counts: number[],
  };
};
```

> **Lý do schema mới (cluster 5 reconciliation):** prototype prompt §4.3 yêu cầu UI 4 sections (Summary diff + Recommendation changes + New/Removed grid + Score histogram). Old SRS schema `{ added_to_buy, removed_from_buy, score_changes, new_warnings, resolved_warnings }` chỉ tracked binary buy-flag changes (mất nuance upgrade BÁN→GIỮ và mất histogram visualization). Cluster 5 chose prompt vì richer UX cho user phân tích model/settings change effect.

### ComparePanel Layout (4 sections)

```
┌─────────────────────────────────┐
│ Header: "So sánh A vs B" + X    │
├─────────────────────────────────┤
│ §1 CompareSummary 4-col table   │  ← 6 row metrics
├─────────────────────────────────┤
│ §2 RecommendationChangesTable   │  ← 6 cols, row tint
├─────────────────────────────────┤
│ §3 NewRemovedSection 2-col grid │  ← 2 card
├─────────────────────────────────┤
│ §4 ScoreHistogram (Recharts)    │  ← 6 buckets dual-bar
└─────────────────────────────────┘
```

### §1 CompareSummary

Table 4-col (Metric / Run A / Run B / Δ) với 6 row (scored / buy_count / hold_count / sell_count / avg_score / duration_seconds).

**Δ color theo `positiveIsGood` flag:**

| Metric | positiveIsGood |
|---|---|
| scored | true (more scored = wider coverage) |
| buy_count | true |
| hold_count | null (neutral, không tô màu) |
| sell_count | false (more sells = market cooler signal, "bad" signal cho user mới) |
| avg_score | true |
| duration_seconds | false (longer = slower) |

`positiveIsGood=true` + delta>0 → ssi-up; `positiveIsGood=false` + delta>0 → ssi-down. Avoid bug "tăng SELL count được tô xanh".

Format: int / float (1dp) / `mm:ss` (duration).

### §2 RecommendationChangesTable

TanStack Table 6 cột (Ticker / Tên / Run A rec / Run B rec / Score Δ / Direction).

**Row background tint:**
- `direction='upgrade'` → green tint `withAlpha(--ssi-up, 0.08)`
- `direction='downgrade'` → red tint `withAlpha(--ssi-down, 0.08)`

`<RecommendationBadge size="sm">` cho col Run A và Run B. Sort upgrade-first → delta magnitude DESC.

### §3 NewRemovedSection

2 card grid (md:grid-cols-2): "New entries (only in B)" + "Removed (only in A)". Title format: `"{count} mã"`. Empty message khi count=0: "Không có mã nào".

Mỗi card list mã sort score DESC (max ~10 visible, scrollable).

### §4 ScoreHistogram

Recharts `<BarChart>` 2 series:
- Series A: fill `var(--ssi-up)`
- Series B: fill `var(--ssi-info)`

X-axis: 6 buckets từ [g03 §R SCORE_DISTRIBUTION_BUCKETS](g03-appendix-enums-constants.md) (`<30 / 30-45 / 45-60 / 60-75 / 75-90 / ≥90`).

Y-axis: count. Theme-aware qua CSS var.

### Compare Compute (no endpoint roundtrip)

`computeCompare({run_a, run_b})` thuần function trong `mocks/data/compare-compute.ts`. Compute trực tiếp từ `runsStore.get(a).computed.results` thay vì gọi lại `/api/runs/{id}/results` 2 lần như endpoint thật. **Trade-off:** mai mốt thay MSW bằng backend thật, compare endpoint sẽ phải tự fetch results — KHÔNG concern cluster prototype.

REC_RANK heuristic upgrade direction: `BAN=0, GIU=1, MUA=2` (xem [g03 §Q](g03-appendix-enums-constants.md)). Direction = `rank_b > rank_a ? 'upgrade' : 'downgrade'`.

### Acceptance Criteria — Compare

| AC ID | Criteria |
|---|---|
| AC-12-13 | 4-branch toggle: click A → clear+shift B; click B → clear B; click new khi A rỗng → set A; click new khi A có → set B. Cùng run không thể là cả A và B (server validate 400) |
| AC-12-14 | ComparePanel render 4 sections; CompareSummary Δ color theo positiveIsGood (sell_count + duration "+ là xấu") |
| AC-12-15 | RecommendationChangesTable row tint upgrade green / downgrade red; sort upgrade-first → delta magnitude DESC |
| AC-12-16 | ScoreHistogram 6 buckets dual-bar; bucket boundaries low-inclusive high-exclusive theo [g03 §R](g03-appendix-enums-constants.md) |

## UC-12-03: Backtest

### BacktestModal Input

2 date inputs:

| Field | Default | Constraint |
|---|---|---|
| period_from | TODAY-6mo | max=`periodTo` |
| period_to | TODAY | min=`periodFrom` + max=TODAY |

Cross-validation: `period_from < period_to` (server fallback 400 nếu false).

### 2-Stage Polling Pattern

```
Stage 1: POST /api/backtest → 202 { backtest_id, status: PENDING }
         setActiveId(backtest_id)

Stage 2: usePolling on /api/backtest/{id}/status
         interval 1.5s, terminal=COMPLETED|FAILED
         When status === 'COMPLETED':
           fire /api/backtest/{id}        (metrics)
           fire /api/backtest/{id}/results (per-ticker rows)
           via useApiResource
```

**Polling 1.5s** (KHÔNG 2s như run polling cluster 2): backtest chỉ chạy 8.5s mock total → polling 2s tick chỉ 4 lần → progress jump 5%→25%→55%→80%→100% rời rạc. 1.5s tick 5-6 lần smooth hơn.

State machine 4 transitions: PENDING → RUNNING ×3 (5%→25%→55%→80%) → COMPLETED.

### BacktestResultCard

**Header:** `backtest_id` + period range + `correct_count/total_count`.

**4 metric cards:**

| Card | Format | Color rule |
|---|---|---|
| Accuracy | `text-3xl` `XX.X%` | ≥60% → `var(--ssi-up)` green; <60% → `var(--ssi-down)` red |
| Price error | `XX.X%` | Neutral (text-primary) |
| Portfolio ROI | signed `+/-XX.X%` | ssi-up nếu ≥0, ssi-down nếu <0 |
| Alpha | signed `+/-XX.X%` + hint "Outperformance" | Same signed color rule |

**ROI Chart:** `<BacktestRoiChart>` Recharts `<LineChart>` 2 series:
- Portfolio ROI: stroke `var(--ssi-up)` xanh
- VN-Index ROI: stroke `var(--ssi-info)` xanh dương
- Tick formatter: `${pct}%`
- Tooltip: 2dp signed
- 9-26 weekly points trải đều giữa period_from và period_to

Gap giữa 2 line ≈ alpha (visualization).

**Toggle "Xem chi tiết X mã"** → expand `<BacktestDetailTable>`.

### BacktestDetailTable (TanStack Table, 7 columns)

| # | Column | Field | Format |
|---|---|---|---|
| 1 | Ticker | `ticker` | Bold |
| 2 | Predicted | `predicted_recommendation` | `<RecommendationBadge size="sm">` |
| 3 | Predicted price | `predicted_price` | 2dp ngàn đồng |
| 4 | Actual price | `actual_price` | 2dp ngàn đồng |
| 5 | Sai số % | `price_error_pct` | `XX.XX%` |
| 6 | Actual return 3M | `actual_return_3m` | signed `+/-XX.XX%` |
| 7 | Đúng? | `recommendation_correct` | `<Check>` (green) / `<X>` (red) icon |

**Default sort:** `[{ id: 'price_error_pct', desc: true }]` — sai số lớn nhất trước (informative cho model failure analysis).

### Backtest result rows = scored_count latest run (NOT 81)

`results[]` rows dùng từ scored_count run mới nhất (~70-78 mã sau khi loại 4 vòng), KHÔNG full 81 universe. Lý do: nếu dùng 81 → có MOCK_INSUFFICIENT + mã loại 4 vòng → không có recommendation hợp lệ để compare. Card subtitle ghi rõ `correct/total`.

**Heuristic correctness** (mock-only, prototype):
- MUA correct: `actual_return_3m > 0`
- GIỮ correct: `-7% ≤ actual_return_3m ≤ +12%`
- BÁN correct: `actual_return_3m < 0`

Per [PRD §4.5 strict](../PRD_v0.5A_Final_Locked.md), backend phase phải check outperform VN-Index per-ticker — mock không track per-ticker VN-Index reference. **Trade-off:** acceptable cho prototype UX; backend (Phase 4) implement strict version.

### Acceptance Criteria — Backtest

| AC ID | Criteria |
|---|---|
| AC-12-17 | BacktestModal cross-validation: period_from < period_to; date picker max=TODAY ngăn future; submit fail → inline error |
| AC-12-18 | 2-stage polling: POST start trả 202 → poll status 1.5s → terminal COMPLETED → fire metrics + results 2 endpoints; FAILED → render error |
| AC-12-19 | BacktestResultCard 4 metric cards: accuracy threshold ≥60% green / <60% red; alpha hint "Outperformance" |
| AC-12-20 | BacktestRoiChart 2-series LineChart; gap giữa 2 line ≈ alpha; theme-aware qua CSS var |
| AC-12-21 | BacktestDetailTable 7 cột default sort `[price_error_pct DESC]`; "Đúng?" icon green check / red X |
| AC-12-22 | Đang backtest → button "Run Backtest" disabled với label "Đang backtest…"; chưa có run nào → button disabled với title hint |
| AC-12-23 | Recommendation accuracy mock dùng heuristic (MUA: return>0, GIỮ: -7..+12, BÁN: return<0); backend Phase 4 strict per [PRD §4.5](../PRD_v0.5A_Final_Locked.md) outperform VN-Index |
| AC-12-24 | Price error là mean absolute (không signed) |
| AC-12-25 | Portfolio ROI giả lập dùng allocation weights từ run, chưa tính phí/slippage (post-MVP per PRD §3.4) |
| AC-12-26 | Alpha = Portfolio ROI − VN-Index ROI; signed +/− render |
