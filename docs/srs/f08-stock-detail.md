---
name: SRS-08 Stock Detail
description: Trang chi tiết mã: header + candlestick + radar/features + entry signal + risk panel. Phase 2.
type: feature
module: SRS-08
prd_fr: FR-06
phase: 2
version: v1.4 LOCKED (cluster 4 reconciliation)
---

# F08 — Stock Detail

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f02-feature-engineering.md](f02-feature-engineering.md), [f03-entry-point-logic.md](f03-entry-point-logic.md), [f05-price-board.md](f05-price-board.md) (deep-link source), [f07-red-flags-risk-warnings.md](f07-red-flags-risk-warnings.md), [f09-risk-management.md](f09-risk-management.md), [f10-news-sentiment.md](f10-news-sentiment.md) (deep-link source), [f11-portfolio-lite.md](f11-portfolio-lite.md) (deep-link source)
> Related — global: [g03](g03-appendix-enums-constants.md) (Recommendation, EntrySignal, WarningBadge, ReasonCodes, 38 Feature IDs)
> Related — tech: [TAD g01-runtime §4.5](../tad/g01-runtime.md) (RunContext hydration)

## Changelog

- **v1.3 (2026-05-09, cluster 3 reconciliation):** ❌ REMOVED ASCII single-block layout (wireframe pre-prototype) → ✅ REPLACED bằng 5-section detailed spec match prototype. Bollinger Bands status → **deferred** (raw_indicators payload đã có, UI toggle chưa wire — cluster 6 enable). MA20/50/200/MA-Vol added (Fix #2 candlestick upgrade). 2-tier interval/lookback selector replaces single period. AC-08-06..14.
- **v1.4 (2026-05-09, cluster 4 reconciliation):** ➕ ADDED UC-08-02 Deep-link without run_id → page resolve via `RunContext.lastCompletedRunId` (mount-once hydrate `GET /api/runs?limit=1`); 3-branch loading state phân biệt "đang hydrate" vs "store rỗng" vs "có run nhưng load lỗi". Lý do: cluster 4 phát hiện click ticker từ Price Board / News (không kèm run_id) hiển thị error misleading "Mã không tồn tại trong run này" — bug kiến trúc frontend, sẽ tái xuất hiện với backend thật khi user refresh / share deep link. AC-08-15..16 mới.

## UC-08-01: Display Full Stock Analysis

### Preconditions
Mã đã được scored trong run được chọn (`/runs/{run_id}/stocks/{ticker}` trả 200; nếu mã bị excluded → render error block).

### URL & deep-link

`/stock-detail?run_id={id}&ticker={ticker}` — shape stable, không được đổi (TopMUA, Price Board, News, Portfolio đều deep-link tới đây).

### 5 Sections (theo thứ tự render)

#### Section 1 — Header

| Sub-component | Source | Spec |
|---|---|---|
| Ticker + Name | `static.ticker`, `static.name` | Bold uppercase ticker + plain name |
| `<ExchangeBadge>` | `static.exchange` | HOSE (`var(--exchange-hose)` xanh ssi-up) / HNX (`var(--exchange-hnx)` xanh dương ssi-floor) / UPCOM (`var(--exchange-upcom)` amber riêng — xem [design.md §3.7](../design.md)) outline |
| Sector | `static.sector` | Plain text |
| Current price + delta % | `static.current_price`, `static.reference_price` | TTCK 5-color rule (ceil/up/ref/down/floor) + `<DeltaArrow>` ▲/▼ small |
| `<AiScoreRing>` | `scoring.ai_score` | SVG donut tier-based color (≥70 var(--ssi-up) / 40-69 amber / <40 var(--ssi-down)) + score number center + "AI Score" label |
| `<RecommendationPill>` | `scoring.recommendation` | Soft-tinted bg alpha 0.15-0.20 + 1px hue border + status dot + label MUA/GIỮ/BÁN. Khác `<RecommendationBadge>` (chip solid color cho tables) — Pill calmer cho header |
| Sub-row: Run selector | `GET /api/stocks/{ticker}/runs` | Dropdown list run ĐÃ CHẤM mã này (rỗng nếu mã chưa scored ở run nào). Click → URL update `?run_id=X` mới |

#### Section 2 — Candlestick Chart

Lightweight Charts v4 (xem [TAD c10](../tad/c10-stock-detail-chart.md) cho architecture chi tiết).

| Element | Spec |
|---|---|
| Data | OHLCV via `GET /api/stocks/{ticker}/prices?interval={D\|W\|M}&lookback={1T\|3T\|6T\|1N\|3N\|YTD\|All}` |
| Volume | Histogram sub-pane (~25% chiều cao, priceScaleId='volume', scaleMargins) |
| 4 priceLine overlays | Support / Resistance / Stop Loss / Target Price — dashed, axisLabel hiển thị giá trị + tên |
| MA overlays | MA20 amber `#f7c948`, MA50 sky blue `#4d96ff`, MA200 pink-red `#ec6090`, MA Vol 20 gray `#9aa4b2`. Toggle via chip ở top-left legend, default MA20+MA50+MA Vol on, MA200 off. State persist `localStorage['stock-v2:candlestick-ma-toggles']` |
| **Bollinger Bands** | **DEFERRED** — `raw_indicators.bollinger_upper/lower` đã có trong payload, UI toggle sẽ wire ở cluster 6 |
| 2-tier selector | Tier 1 (interval): segmented pill `D \| W \| M`. Tier 2 (lookback): row text button `1T / 3T / 6T / 1N / 3N / YTD / All` (vi labels; en mirror `1M/3M/6M/1Y/3Y/YTD/All`) |
| Threshold-5 disable + auto-bump | Lookback button có `bars < 5` cho interval hiện tại → disabled (opacity 0.35, tooltip "Khoảng quá ngắn"). User đổi interval → nếu lookback hiện < min → auto-bump lên min trước khi render |
| Crosshair legend | Floating overlay top-left: hàng 1 (date + OHLCV + %change) + hàng 2 (4 chip MA toggle). `subscribeCrosshairMove` snapshot → fallback last bar khi mouse leave |
| Theme switching | MutationObserver trên `<html data-theme>` → `chart.applyOptions(buildLayoutOptions())` + repaint candle/volume/MA — KHÔNG re-mount chart (giữ zoom/pan) |

#### Section 3 — ScoreBreakdown + FeatureTable (nested toggle)

| Element | Spec |
|---|---|
| Radar | Recharts 480×400, dual-series: ticker (`scoring.radar`, `var(--ssi-up)` color) + industry avg overlay (`scoring.radar_industry_avg` từ run dashboard, `var(--color-theme-text-secondary)` faded). Custom hover-dot pattern (xem [design.md §6.9](../design.md)) |
| 5 axes | fundamental, technical, macro, realestate, sentiment (scores 0-100) |
| Toggle | Button "Hiển thị 38 features" → expand FeatureTable bên dưới (collapse default) |
| FeatureTable | 5 group collapsible (`fundamental` + `technical` mở mặc định; `macro` / `realestate` / `sentiment` đóng). Columns: ID / Name (vi+en) / Value (formatted theo `format` của feature) / Direction (↑ good / ↓ bad / − neutral). Tone color theo `featureDirectionTone(direction, value, range)`. Imputed feature → icon ⚠ + tooltip "Giá trị suy luận" |

#### Section 4 — EntrySignalPanel

| Element | Spec |
|---|---|
| Card border | Crimson border (signature accent) |
| Hero chip | 7 enum với màu/icon riêng theo `ENTRY_SIGNAL_META[signal]` (xem [g03 §B](g03-appendix-enums-constants.md)). 5 tone đầy đủ (BUY_STRONG / BUY_NOW / WAIT_* / NO_ENTRY / INSUFFICIENT_DATA) — khác `<EntrySignalChip>` cluster 2 (3 tone bucket cho table compact) |
| Reason chips | Parse `entry.reason_code` (e.g. `"VALUATION_ATTRACTIVE+BULLISH_TREND"`) → split `+` → filter qua `REASON_CODES` whitelist (xem [g03 §N](g03-appendix-enums-constants.md)) → render mỗi code thành chip i18n (vi/en theo locale). **GUARD-02**: token unknown bị bỏ, không cho user tạo reason text tự do |
| Mini S/R bar | Visualize current price vs support/resistance zones (horizontal bar) |
| raw_indicators chips | List `entry.raw_indicators_used[]` thành chips (audit trail) |
| INSUFFICIENT_DATA case | Ẩn S/R bar, render fallback message |

#### Section 5 — RiskPanel (3 sub-cards)

3-column grid: StopLossCard | AllocationCard | ConfidenceCard. Specs visual chi tiết tại [f09 §UC-09-03..05](f09-risk-management.md).

INSUFFICIENT_DATA case → render "Không đủ data" message thay vì 3 card.

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-08-01 | Candlestick mặc định D + 6T (~6 tháng daily). Support D/W/M aggregation + 7 lookback values |
| AC-08-02 | Radar 5 axes dual-series (ticker + industry avg overlay) — same run = same peer group |
| AC-08-03 | Entry signal hiển thị 1 trong 7 enum + reason chips parsed từ whitelist (GUARD-02) |
| AC-08-04 | FeatureTable hiển thị đủ 38 features (5 group), imputed → icon ⚠ + tooltip |
| AC-08-05 | Feature value tone (good/bad/neutral) theo `direction` + value range |
| AC-08-06 | Header AiScoreRing tier color đúng: ≥70 xanh / 40-69 amber / <40 đỏ |
| AC-08-07 | RecommendationPill ở header dùng soft-tinted (calmer); chip solid `<RecommendationBadge>` chỉ dùng trong tables |
| AC-08-08 | 2-tier selector: lookback < min của interval → disabled; đổi interval với lookback invalid → auto-bump trước khi render |
| AC-08-09 | MA toggle state persist localStorage, giữ qua reload |
| AC-08-10 | Crosshair legend hiển thị: date + OHLCV + %change + MA snapshots; mouse leave → fallback last bar |
| AC-08-11 | Theme switch (4 themes) → candlestick canvas đổi background/grid/candle color qua MutationObserver, KHÔNG re-mount (giữ zoom/pan) |
| AC-08-12 | Run selector chỉ list run đã chấm mã này; mã chưa ở run nào → dropdown rỗng |
| AC-08-13 | Period switcher refetch (KHÔNG client-side filter) — đổi interval/lookback → fire `useStockPrices` mới với path khác |
| AC-08-14 | INSUFFICIENT_DATA case: ẩn S/R bar trong EntrySignalPanel, render "Không đủ data" thay vì 3 RiskPanel cards |

## UC-08-02: Deep-link Without run_id (cluster 4 post-fix)

### Trigger

User click ticker từ:
- [`f05`](f05-price-board.md) Price Board row
- [`f10`](f10-news-sentiment.md) NewsCard ticker chip
- [`f11`](f11-portfolio-lite.md) PortfolioTable row

URL: `/stock-detail?ticker={X}` (KHÔNG kèm `run_id`).

### Resolution Strategy

`RunContext` (xem [TAD g01-runtime §4.5](../tad/g01-runtime.md)) mount-once fetch `GET /api/runs?limit=1` → set `lastCompletedRunId` nếu run terminal và state đang null (functional updater để không đè run đang chạy). `runsHydrated` flag set true sau khi response về (regardless of empty/non-empty).

Stock Detail page consume `{ lastCompletedRunId, runsHydrated }`:

| State | Branch | UI |
|---|---|---|
| `!runId && !runsHydrated` | Đang hydrate | Loading spinner |
| `!runId && runsHydrated` | Hydrate xong, store rỗng (chưa có run nào terminal) | "noRun" message + CTA "Chạy sàng lọc trước" → trigger RunButton flow |
| `runId && loading` | Có runId, đang fetch detail | Loading spinner |
| `runId && error` | Có runId, fetch lỗi (mã không tồn tại trong run / run failed) | Error block "Không tải được chi tiết mã" |
| `runId && data` | Đầy đủ | Render 5 sections (UC-08-01) |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-08-15 | Deep-link `/stock-detail?ticker=X` không kèm `run_id` → page resolve via `lastCompletedRunId`; nếu không có run terminal nào → render "noRun" message (KHÔNG flash error block "Mã không tồn tại") |
| AC-08-16 | Loading state phân biệt "đang hydrate runs" vs "đang fetch detail" vs "không có run nào" — KHÔNG render error misleading lúc đang hydrate |
