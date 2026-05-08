# Cluster 3 Summary — Stock Detail Deep-dive

## 1. Metadata

- **Cluster:** 3 — Stock Detail
- **Khoảng ngày:** 2026-05-07 (1 phiên build)
- **Commit kết thúc:** sẽ commit ngay sau session này — toàn bộ thay đổi cụm 3 đang ở working directory.
- **Prompt:** [prompts/cluster-3-stock-detail.md](../prompts/cluster-3-stock-detail.md)
- **Cluster trước:** `a0bebf2` `feat(prototype): cluster 2 — screening flow + retroactive reports`
- **Verify cụm trước:** chạy `npm run lint` + `npm run build` sạch trước khi bắt đầu.

## 2. Phạm vi

**Dự kiến (theo prompt):** page `/stock-detail` 5 sections (Header, Candlestick, ScoreBreakdown+FeatureTable, EntrySignalPanel, RiskPanel), 3 MSW handlers (`/runs/{id}/stocks/{ticker}`, `/stocks/{ticker}/prices`, `/stocks/{ticker}`), components stock-detail/* + ExchangeBadge, hooks `useStockDetail`/`useStockPrices`, i18n keys, `lightweight-charts` dep, anchor fixtures cho 7 entry signals.

**Thực tế làm:** đầy đủ scope.

**Mở rộng ngoài prompt (cố ý):**
- Thêm endpoint `GET /api/stocks/{ticker}/runs` để header dropdown "Run đã chấm mã này" (acceptance #10) chỉ list run thực sự đã chấm — prompt nói "switch giữa các run đã chấm mã này" nhưng không nêu cụ thể endpoint.
- Bug fix tại layer cluster 2: `entrySignalFromScore` cũ KHÔNG xử lý SRS-03 Step 2 (rec≠MUA → NO_ENTRY). Đã thay bằng `decideEntrySignal(ticker, score, rec, badges)` có (a) anchor overrides cho 7 enums, (b) recommendation gate, (c) tránh trả `WAIT_FOR_*` cho mã GIU/BAN. TopMUA chỉ filter MUA nên không thay đổi behavior; Red Flags không show entry chip; an toàn.
- Anchor scores cho `VHM=91, KDH=82, NLG=78, DXG=76, PDR=75` để rec=MUA và 7 enum entry signals đều có fixture cụ thể.
- KDH carry 1 warning badge `HIGH_INVENTORY` (theo TAD g02 §4 example) — demo confidence -5pp.

**Không cắt mục lớn nào.** Riêng "MA20/50/200 + Bollinger Bands overlay trên candlestick" mà SRS-08 layout có → prompt §3.2 lại chỉ liệt kê 4 line (S/R/SL/Target) → tôi theo prompt (4 line dashed). MA/Bollinger có sẵn trong `raw_indicators` payload, sẵn sàng add ở cụm sau nếu cần.

## 3. File mới

### Mock data layer (5 file)
- [src/mocks/data/feature-dict.ts](../prototype/src/mocks/data/feature-dict.ts) — 38 scoring feature dictionary theo PRD Appendix A; mỗi entry có `id`, `group`, vi/en label, `direction`, `format`, `range`. Helper `formatFeatureValue` + `featureDirectionTone` cho FeatureTable.
- [src/mocks/data/reason-codes.ts](../prototype/src/mocks/data/reason-codes.ts) — 15 reason codes, label vi/en, `parseReasonCode("VALUATION_ATTRACTIVE+BULLISH_TREND")`, `DEFAULT_REASON_BY_SIGNAL` cho mỗi entry signal.
- [src/mocks/data/warning-badges.ts](../prototype/src/mocks/data/warning-badges.ts) — meta cho 4 warning badges với trigger condition (vi+en) → ConfidenceCard tooltip.
- [src/mocks/data/prices-fixture.ts](../prototype/src/mocks/data/prices-fixture.ts) — OHLCV generator deterministic per ticker; mulberry32 + gaussish drift; anchor close cuối = `currentPrice` để khớp header. Period 1M=22, 3M=66, 6M=125, 1Y=250 days; weekend skip.
- [src/mocks/data/stock-detail-compute.ts](../prototype/src/mocks/data/stock-detail-compute.ts) — compose `StockDetailResponse` từ `ScreeningResult` cluster 2 + radar + run dashboard. Sinh 38 features từ group score (direction-aware), 0-3 imputed; raw_indicators (RSI/MA/Bollinger/MACD/SR) bám entry signal type để demo coherent.

### Components — stock-detail/ (8 file)
- [src/components/stock-detail/StockHeader.tsx](../prototype/src/components/stock-detail/StockHeader.tsx) — ticker + name + exchange + sector | current price + delta % theo TTCK rule (ceil/up/ref/down/floor) | AI Score + RecommendationBadge. Sub-row run selector.
- [src/components/stock-detail/CandlestickChart.tsx](../prototype/src/components/stock-detail/CandlestickChart.tsx) — Lightweight Charts wrapper; candlestick + volume histogram (priceScaleId='volume', scaleMargins top 0.7); 4 priceLine overlays (S/R/SL/Target dashed); period switcher 1M/3M/6M/1Y; reset zoom; theme-aware via MutationObserver trên `[data-theme]` → applyOptions.
- [src/components/stock-detail/ScoreBreakdown.tsx](../prototype/src/components/stock-detail/ScoreBreakdown.tsx) — Radar 480×400 với 2 series (ticker + industry avg faded); toggle "Hiển thị 38 features" → mount FeatureTable.
- [src/components/stock-detail/FeatureTable.tsx](../prototype/src/components/stock-detail/FeatureTable.tsx) — 5 group collapsible (fundamental + technical mở mặc định), columns ID/Name/Value/Direction; tone good/bad/neutral theo `featureDirectionTone`; imputed icon ⚠ với tooltip.
- [src/components/stock-detail/EntrySignalPanel.tsx](../prototype/src/components/stock-detail/EntrySignalPanel.tsx) — Card crimson border; hero chip 7 enum với màu/icon riêng theo `ENTRY_SIGNAL_META`; reason codes parsed → chip list i18n; mini SRBar visualization current vs S/R; raw_indicators_used chips; INSUFFICIENT_DATA case ẩn S/R bar.
- [src/components/stock-detail/RiskPanel.tsx](../prototype/src/components/stock-detail/RiskPanel.tsx) — Wrapper grid 3-col cho 3 sub-cards; INSUFFICIENT_DATA → render "Không đủ data" thay vì 3 card.
- [src/components/stock-detail/StopLossCard.tsx](../prototype/src/components/stock-detail/StopLossCard.tsx) — number lớn đỏ; calc note "buy_price × 0.90" hoặc "current_price × 0.90 (chưa có buy)"; distance %.
- [src/components/stock-detail/AllocationCard.tsx](../prototype/src/components/stock-detail/AllocationCard.tsx) — VND format `fr-FR`; weight %; based-on note. Nếu `total_capital ≤ 0` → render "Bỏ qua phân bổ" placeholder (AC-09-06).
- [src/components/stock-detail/ConfidenceCard.tsx](../prototype/src/components/stock-detail/ConfidenceCard.tsx) — Visual bar `final | penalty` (xanh + cam); 3 label tabular; warning badges chips bên dưới với tooltip giải thích (vi/en theo locale).

### Components — badges/ (1 file)
- [src/components/badges/ExchangeBadge.tsx](../prototype/src/components/badges/ExchangeBadge.tsx) — HOSE (xanh) / HNX (xanh dương) / UPCOM (vàng) outline.

### Hooks (1 file)
- [src/lib/hooks/useStockDetail.ts](../prototype/src/lib/hooks/useStockDetail.ts) — wrapper `useApiResource` cho 3 endpoint detail/prices/runs. Single point of contact để cụm sau migrate sang SWR/React Query nếu cần.

## 4. File sửa

- [src/lib/constants.ts](../prototype/src/lib/constants.ts) — thêm `ENTRY_SIGNAL_META` (tone + priority order theo SRS-03). Why: source-of-truth cho EntrySignalPanel + chip styling, không trùng với cluster-2 `EntrySignalChip` (cluster 2 dùng 3 tone bucket; cụm 3 cần per-enum tone + priority).
- [src/lib/types.ts](../prototype/src/lib/types.ts) — thêm `StockStaticInfo`, `StockDetailResponse` (mirror TAD g02 §4 đầy đủ), `OhlcvBar`, `StockPricesResponse`, `TickerRunSummary`, `TickerRunsResponse`. Why: lock shape cho 3 endpoint mới của cụm 3 + `radar_industry_avg` overlay.
- [src/mocks/handlers.ts](../prototype/src/mocks/handlers.ts) — 4 handler mới: `/runs/{id}/stocks/{ticker}` (compose detail), `/stocks/{ticker}` (static), `/stocks/{ticker}/prices?period=*` (synthetic OHLCV), `/stocks/{ticker}/runs` (which runs scored this ticker).
- [src/mocks/data/run-compute.ts](../prototype/src/mocks/data/run-compute.ts) — (a) `entrySignalFromScore` → `decideEntrySignal(ticker, score, rec, badges)` với anchor overrides + recommendation gate; (b) anchor scores VHM=91 / KDH=82 / NLG=78 / DXG=76 / PDR=75; (c) KDH thêm `HIGH_INVENTORY` badge để demo confidence -5pp. Why: AC #6 yêu cầu 7 entry signals test được; AC-03-02 (rec≠MUA → NO_ENTRY) cluster 2 chưa enforce.
- [src/messages/{vi,en}.json](../prototype/src/messages/) — thêm namespace `stockDetail.*` (~80 keys/file). Why: convention bilingual mọi key.
- [src/app/(app)/stock-detail/page.tsx](../prototype/src/app/(app)/stock-detail/page.tsx) — replace `<ComingSoon clusterNumber={3} />` bằng full page wiring 5 sections + run selector + period switcher + reload listener cho `lastCompletedRunId`.

## 5. Refactor / nâng cấp

- **Entry signal logic được unify**: trước cụm 3, `entrySignalFromScore` chỉ phụ thuộc score + badges → trả `WAIT_FOR_*` cho cả mã GIU/BAN (vi phạm AC-03-02). Cụm 3 thay bằng `decideEntrySignal` honor recommendation gate + ANCHOR_ENTRY_OVERRIDES. TopMUA / Red Flags rendering không thay đổi (TopMUA filter `rec=MUA`; Red Flags không show entry chip).
- **`EntrySignalChip` (cluster 2) vs `EntrySignalPanel` (cụm 3) tách trách nhiệm**: chip dùng 3 tone bucket cho table compact; panel hero dùng 5 tone đầy đủ theo `ENTRY_SIGNAL_META`. Cụm sau muốn unify thì dùng `ENTRY_SIGNAL_META[signal].tone`.
- **`STOCK_FIXTURE` ổn định 81 mã**: chưa thay đổi shape; chỉ thêm nội dung `seed` được cụm 3 reuse cho `prices-fixture.ts`. Pattern: per-ticker seed = một identifier mock duy nhất cho fundamental + technical + price history → tất cả đều coherent với nhau.
- **Provider stack giữ nguyên 7 lớp** (cluster 2). Cụm 3 không thêm context — toàn bộ state cục bộ trong `/stock-detail/page.tsx` (period, reloadKey).

## 6. Quyết định kỹ thuật

- **Lightweight Charts v4 + MutationObserver theme**: `createChart` với layout colors đọc từ `getComputedStyle(documentElement)` cho CSS vars. Khi `<html data-theme>` đổi (ThemeContext set), MutationObserver re-call `chart.applyOptions(buildLayoutOptions())` + reapply candle colors. Thay vì re-mount chart (mất zoom/pan state). Cluster 2 summary §9 cảnh báo "theme switch trên Recharts SVG chưa user-verify"; với Lightweight Charts (canvas) tôi chủ động hook MutationObserver vì canvas không follow CSS var.
- **Volume histogram trên priceScaleId='volume' + scaleMargins**: theo pattern chuẩn của Lightweight Charts v4 cho volume sub-pane (~30% chiều cao). Không dùng overlay scale mặc định để tránh price + volume chia sẻ axis.
- **Overlay lines = `series.createPriceLine`** (không phải `addLineSeries`): priceLine luôn nằm ở y=price độc lập với time axis → 4 đường S/R/SL/Target horizontal đúng. `addLineSeries` sẽ cần fake bars với cùng giá → bloat chart data.
- **OHLCV anchor close cuối = currentPrice**: chart's right edge khớp header price hiển thị (không lệch sai do random walk). Demo coherent.
- **38 features sinh từ group radar score, không từ độc lập**: feature `F03 (ROE)` của VHM (fundamental=82) sẽ ở top range 12-22 → ~20%; `F03` của MOCK_SELL (fundamental=30) sẽ ở bottom → ~6%. → FeatureTable hiển thị tone consistent với radar shape, không "lệch ngẫu nhiên".
- **Anchor entry signal overrides**: 5 ticker thật (VHM/KDH/NLG/DXG/PDR) cover 5 enum BUY_*/WAIT_*; MOCK_HOLD/SELL → NO_ENTRY qua recommendation gate; MOCK_INSUFFICIENT excluded → INSUFFICIENT_DATA via 404 fallback (handler trả 404 → page render error). Để test INSUFFICIENT_DATA UX inline, cần thêm anchor sau (TODO §9).
- **Reason code parser strict whitelist** (GUARD-02): split '+' → filter qua `REASON_CODES` enum. Token unknown bị bỏ. Không cho user tạo reason text tự do.
- **Industry avg radar overlay từ run dashboard**: thay vì sinh independent → bám vào `r.computed.dashboard.radar` (avg toàn run). Lý do: cùng run → cùng peer group → so sánh có nghĩa.
- **`useStockDetail`/`useStockPrices`/`useTickerRuns` thin wrapper** trên `useApiResource`: không tự cache cross-component (cụm 5 nếu cần Run History compare có thể chuyển SWR ở 1 file này, không phải 3 component).
- **Period switcher refetch** (không client-side filter): mỗi 1M/3M/6M/1Y trigger `useApiResource` mới với path khác → MSW gen lại OHLCV với seed khác (mix `days * 31` vào seed) → 1Y tail không trùng 6M tail. Nếu client-side filter, tail luôn giống nhau gây illusion "không đổi data".
- **Lightweight Charts dynamic import KHÔNG dùng**: bundle ~263KB First Load JS cho `/stock-detail` chấp nhận được (acceptable vs MVP target). Dynamic import sẽ thêm complexity skeleton state.
- **Recharts cũ + Recharts mới (RadarChart 5-axis 2-series)**: cluster 2 có sẵn `RadarChart` 1 series; cụm 3 không reuse được vì cần overlay industry avg → viết inline trong `ScoreBreakdown.tsx` thay vì refactor.

## 7. Dependencies

**Thêm mới (deps):**
- `lightweight-charts@^4.2.3` — candlestick + volume + priceLine overlays (TAD §2 chốt). Bundle ~40KB.

**Bỏ / upgrade:** không có.

**Vulnerabilities:** `npm install` báo 6 vuln (2 mod / 3 high / 1 critical) — đều trong tree cũ từ cluster 2 (next/msw…), không phải lightweight-charts. Để cụm 6 audit chung.

## 8. Mock data

- **StockDetailResponse** ([stock-detail-compute.ts](../prototype/src/mocks/data/stock-detail-compute.ts)): từ `ScreeningResult` + `master_seed = ticker.charCodeAt(0)*13 + run_id.length*17` + `tickerSeed*7` → mulberry32. Output mirror TAD g02 §4 với `static`, `scoring`, `entry`, `raw_indicators`, `risk`, `reasons`, `features` (38 keys), `imputed_features` (0-3 IDs), `feature_availability` (35-38), `radar`, `radar_industry_avg`.
- **38 features dict** ([feature-dict.ts](../prototype/src/mocks/data/feature-dict.ts)): F01-F16 fundamental (16), T01-T09 technical (9), M01-M05 macro (5), R01-R05 realestate (5), S01-S03 sentiment (3) = 38. Mỗi entry có direction (high/low/none), format (percent/currencyB/ratio/score/sentiment/number), range để sinh value.
- **OHLCV** ([prices-fixture.ts](../prototype/src/mocks/data/prices-fixture.ts)): 22/66/125/250 days; daily vol 1.8% + drift 0.08%; volume 200K-2M + 5% spike chance; weekend skip; deterministic per (ticker_seed, period).
- **Reason codes** ([reason-codes.ts](../prototype/src/mocks/data/reason-codes.ts)): 15 codes vi/en + `DEFAULT_REASON_BY_SIGNAL[signal]` → array đa code → join '+' để format reason_code; parser split '+' → filter whitelist.
- **Anchor entry signal fixtures**: VHM=BUY_STRONG, KDH=BUY_NOW (+1 badge HIGH_INVENTORY), NLG=WAIT_FOR_BREAKOUT, DXG=WAIT_FOR_PULLBACK, PDR=WAIT_FOR_CONFIRMATION, MOCK_HOLD/SELL→NO_ENTRY, MOCK_INSUFFICIENT excluded. 7/7 enum cover.
- **Warning badge meta** ([warning-badges.ts](../prototype/src/mocks/data/warning-badges.ts)): trigger_vi/en cho tooltip ConfidenceCard.

## 9. Nợ kỹ thuật / TODO

- **Bug đã sửa post-build (round 2 audit)**:
  - **Candle/volume overlap**: `priceScale('right').scaleMargins = { top: 0.05, bottom: 0.3 }` để candle chiếm 70% trên, volume 25% dưới — trước đây cả 2 đều fill 100% gây tràn wick xuống volume.
  - **`master_seed = run_id.length * 17`** trong handler stock detail → collision: 3 seed run cùng độ dài 10 → cùng ticker switch run features y chang nhau (vi phạm AC #10). Đã thay bằng FNV-like hash trên content `run_id`.
  - **Theme switch không repaint volume tints + overlay line colors**: volume bar `${upColor}55` và overlay `readVar('--ssi-up')` được capture tại data-paint time. Khi theme đổi, MutationObserver chỉ apply layout + candle colors, KHÔNG đụng tới 2 thứ này → bị stuck màu cũ. Đã refactor `repaintData/repaintOverlays` thành single path, theme apply() gọi lại cả 2 với refs `barsRef`/`overlaysRef`.
- **Cụm 3 đang ở working dir** chờ commit cuối session này. (Cụm 2 đã được commit ở `a0bebf2` `feat(prototype): cluster 2 — screening flow + retroactive reports`.)
- **MOCK_INSUFFICIENT chưa test được trong UI**: ticker này bị excluded ở vòng 4 → handler `/runs/{id}/stocks/MOCK_INSUFFICIENT` trả 404 → page render error block thay vì panel "INSUFFICIENT_DATA UX đặc biệt" (acceptance #8). Fix gợi ý: thêm 1 anchor `MOCK_INSUFFICIENT_SCORED` (scored thay vì excluded) với `entry_signal=INSUFFICIENT_DATA + feature_availability=30`. Hoặc cho handler stock-detail check excluded → render shape khác thay vì 404. Chọn cụm sau.
- **MA20/50/200 + Bollinger Bands overlay trên candlestick**: SRS-08 layout có nhưng cluster-3 prompt §3.2 chỉ nêu 4 line S/R/SL/Target → tôi theo prompt. `raw_indicators` payload đã có sẵn 5 chỉ báo này → cụm 6 nếu refactor candlestick có thể bật overlay tương ứng. **(MA20/50/200 đã được bật ở Fix #2 — xem §12. Bollinger Bands vẫn chưa.)**
- **Theme switch trên candlestick canvas chưa user-verify thực tế**: lý thuyết `MutationObserver([data-theme]) → applyOptions` đúng, nhưng chưa test browser. Cụm 4 (Price Board) sẽ stress-test theme switching nhiều — theo dõi.
- **`reference_price` trong header sinh ngẫu nhiên ±1%** thay vì lấy từ pricing engine thật → delta % cosmetic. Cụm 4 bảng giá sẽ cần `reference_price` thật từ phiên trước → revisit shape `StockStaticInfo`.
- **Run selector trong header chỉ list run mà ticker được scored**: ticker MOCK_INSUFFICIENT → mọi run đều excluded → list rỗng → header không show selector. Acceptable nhưng có thể confusing — cụm sau hiển thị empty state với hint "Mã này không xuất hiện trong run nào".
- **Cluster 3 chưa browser-verify**: tôi chỉ chạy `npm run lint` + `npm run build` + `curl /stock-detail` trả 200. Hai thứ chưa verified bằng mắt: (1) candlestick render đúng, (2) theme switching live. Cần test thủ công trước khi closed.
- **`current_price` đơn vị "ngàn đồng" vẫn chưa thống nhất** (đã ghi nhận trong cluster-2-summary §9). Cụm 3 reuse convention; chưa thêm helper. Cụm 4/5 buộc phải fix khi join với portfolio (đơn vị `cp`) và market cap (`tỷ`).
- **Lightweight Charts `removePriceLine` mỗi lần overlay đổi**: đang re-create 4 line; nếu props không đổi vẫn re-create. Optimization sau này: diff overlay → chỉ update line thay đổi.

## 10. Ảnh hưởng cluster sau

- **Cluster 4 (Market & Browse) — phụ thuộc trực tiếp:**
  - Reuse `useStockPrices(ticker, period)` cho Price Board mini chart trong row click.
  - `StockStaticInfo` shape sẽ là source-of-truth cho Price Board cells (current/reference/exchange/sector).
  - `OhlcvBar` shape ổn định, có thể cache toàn cục nếu cần.
  - News page reuse pattern `useApiResource` + filter chips từ `EntrySignalPanel.tsx`.
- **Cluster 5 (Personal & History):**
  - Run History compare 2 run sẽ list tickers thay đổi `entry_signal` — endpoint `/runs/{id}/stocks/{ticker}` đã sẵn sàng.
  - Portfolio Lite cần `StockDetailResponse.risk.stop_loss_price` để cảnh báo cắt lỗ → reuse handler.
  - `TickerRunsResponse` (mới) cũng dùng được cho "Mã đã ở run nào".
- **Cluster 6 (Export & Integrations):**
  - PDF export (TAD g02 §1 `/export/pdf/{run_id}`) sẽ render Stock Detail per ticker → tận dụng `StockDetailResponse` shape; canvas chart cần screenshot offline (lightweight-charts có `takeScreenshot()` API).
  - Telegram Top N message reuse `entry.signal` + `scoring.recommendation` + `risk.stop_loss_price`.
- **Quy ước ổn định không nên đổi:**
  - URL `/stock-detail?run_id=X&ticker=Y` (TopMuaTable đã link).
  - `StockDetailResponse` field naming theo TAD g02 §4 (`scoring.confidence_raw|penalty|final`, `risk.allocation_amount|weight`).
  - `ENTRY_SIGNAL_META` priority order (SRS-03).

## 11. Test thủ công

| Bước | URL / Action | Kỳ vọng |
|---|---|---|
| 1 | `npm install` (lightweight-charts mới) → `NEXT_PUBLIC_ENABLE_MSW=1 npm run dev` → login | Build success; vào Dashboard thấy 5 KPI + 6 visuals |
| 2 | Run xong → `/top-mua` → expand 1 row VHM → click "Xem chi tiết" | Navigate đúng `/stock-detail?run_id=run_xxx&ticker=VHM` |
| 3 | `/stock-detail?run_id=run_seed_3&ticker=VHM` | 5 sections render: header VHM với AI Score 91 + MUA badge; candlestick 6T với 4 overlay; radar 5 axes + industry avg overlay; entry panel BUY_STRONG 🟢 với reason chips; risk 3 cards |
| 4 | Click 1M / 3M / 6M / 1Y trong candlestick toolbar | Mỗi click refetch `/api/stocks/VHM/prices?period=*` (Network tab); chart re-render với data tương ứng; close cuối luôn = current_price header |
| 5 | Click "Hiển thị 38 features" | Bảng expand hiện 5 group; group fundamental + technical mở mặc định; click header group khác → expand; mỗi feature có ID + value (color-coded) + direction icon ↑/↓/− |
| 6 | Đổi ticker thành KDH | Entry chip = BUY_NOW 🟢; Confidence card hiện bar có band cam (penalty -5pp); 1 warning chip "Tồn kho cao" với tooltip |
| 7 | Đổi ticker thành NLG / DXG / PDR / MOCK_HOLD / MOCK_SELL | Entry chip lần lượt: WAIT_FOR_BREAKOUT 🟡 / WAIT_FOR_PULLBACK 🟡 / WAIT_FOR_CONFIRMATION 🟡 / NO_ENTRY ⚫ / NO_ENTRY ⚫ — đủ 6/7 enum |
| 8 | `/stock-detail?run_id=run_seed_3&ticker=MOCK_INSUFFICIENT` | **Hiện tại render error block "Mã không có trong run này"** — TODO §9: cần thêm anchor SCORED-INSUFFICIENT để test enum 7 trong UI |
| 9 | Đổi theme dropdown (4 trạng thái) khi đang ở Stock Detail | Candlestick canvas đổi background + grid + candle color (`MutationObserver` re-applyOptions); radar SVG đổi text/grid color qua CSS var; cards đổi bg |
| 10 | Sub-row Run Selector trong header → chọn run cũ | URL update `?run_id=X` mới; `useStockDetail` refetch; header + candlestick overlays + entry panel update; period switcher giữ nguyên |
| 11 | Direct nav `/stock-detail` (không có ticker) | Render hint "URL thiếu tham số ticker. Vào Top MUA…" |
| 12 | Mã không tồn tại: `/stock-detail?run_id=run_seed_3&ticker=ZZZ` | Render error block đỏ "Mã ZZZ không có trong run này" |
| 13 | DevTools Network khi vào `/stock-detail?...&ticker=VHM` | 4 request: `/api/runs/run_seed_3/stocks/VHM`, `/api/stocks/VHM/runs`, `/api/runs/run_seed_3`, `/api/stocks/VHM/prices?period=6M` (period đổi → chỉ request prices được fire lại) |
| 14 | `npm run build` + `npm run lint` | Pass strict TypeScript + ESLint clean (✓ verified) |
| 15 | Run mới complete trong lúc đang ở Stock Detail | `lastCompletedRunId` đổi → `reloadKey++` → tất cả 4 hook re-fetch; header AI Score có thể đổi nếu run mới chấm khác |

## 12. Post-cluster fixes

### Fix #1 — Radar tooltip nhảy lung tung trên ScoreBreakdown (2026-05-08)

**Triệu chứng:** Hover radar 5 nhóm features ở Stock Detail, tooltip bám cursor + snap nhảy giữa các điểm gần nhất → "lung tung". Cũng không có chấm tròn ở vertex để biết hover vào đâu (recharts mặc định `dot={false}`).

**Root cause:** Recharts `<Tooltip>` mặc định trong RadarChart dùng polygon-area hover detection + position bám cursor. Default behavior, không phải bug code.

**Fix:** Cùng giải pháp với cluster 2 (xem [cluster-2-summary.md §12 Fix #4](cluster-2-summary.md) cho chi tiết design). Tóm tắt:
- Tạo helper mới `prototype/src/components/charts/radar-tooltip.tsx`: `radarOutwardVector(index, total)` (geometry), `createRadarHoverDot(...)` (factory), `<RadarHoverTooltip>` (popup absolute-positioned).
- Tooltip position từ tọa độ cực của dot (90°-i*72°) + offset 30px outward → đứng yên, luôn ngoài polygon.

**Áp dụng cho dual-series ScoreBreakdown:** 2 dot renderers tách biệt — `renderTickerDot` (`ssi-up`, seriesName từ `t('legend.ticker', { ticker })`) và `renderIndustryDot` (`text-secondary`, seriesName từ `t('legend.industry')`). Hover ticker dot show ticker value, hover industry dot show industry value (không show cả 2 cùng lúc — đúng spec singular).

Wrapper div radar đổi sang `className="relative"` để absolute tooltip position đúng. Bỏ import `<Tooltip>` từ recharts.

**Verify:** `tsc --noEmit` pass clean.

**File touched:** `prototype/src/components/stock-detail/ScoreBreakdown.tsx`. Helper mới được tạo trong cluster 2 charts/ folder và dùng chung — log chính ở `cluster-2-summary.md §12 Fix #4`.

### Fix #2 — Candlestick chart upgrade theo phong cách platform tài chính (2026-05-08)

**Bối cảnh:** Bên thứ 3 góp ý 5 điểm cho chart hiện tại để "giống TradingView/TCBS hơn": (A) tách timeframe selector thành 2 tầng (interval D/W/M + lookback 1T/3T/6T/1N/3N/YTD/All); (B1) MA20/50/200 overlay + toggle + legend; (B2) crosshair tooltip floating; (B3) grid mờ + highlight giá hiện tại; (B4) volume panel đẹp hơn + MA volume; (B5) di chuyển legend S/R lên trực tiếp đường line. User yêu cầu đánh giá từng điểm trước khi làm.

**Đánh giá:** Một số điểm đã có sẵn từ cluster 3 (crosshair `CrosshairMode.Magnet`; volume bar xanh/đỏ theo close vs open; volume panel đã 25%; S/R đã có `axisLabelVisible: true` + `title` → label đã tự gắn vào line; chỉ còn block text duplicate dưới chart). Quyết định: bỏ duplicate, làm A + B1 + B3 + B4 (MA volume) + B5 (xóa duplicate); skip B2 vì legend top-left đã cover thông tin OHLC + MA + %change theo crosshair.

**4 bước triển khai:**

**Bước 1 — B5 + B3 (quick wins).** [`CandlestickChart.tsx`]
- Helper mới `withAlpha(hex, alpha)` convert hex → rgba; gridline opacity 100% → 12% (giống TradingView, chart "thoáng" hơn).
- Bật explicit `priceLineVisible: true, priceLineStyle: 2 (dashed), priceLineWidth: 1, lastValueVisible: true` cho candle series → giá close cuối có dashed line ngang + bubble label nổi bật trên trục Y.
- Xóa hẳn block 6 dòng text legend duplicate dưới chart (axis label đã hiện sẵn tên + giá trị trên price line bên phải).

**Bước 2 — Phần A: tách 2 tầng selector + mở rộng fixture + đổi API contract.**
- **Type contract** ([`types.ts`]): thêm `CandleInterval = 'D' | 'W' | 'M'`, `CandleLookback = '1T' | '3T' | '6T' | '1N' | '3N' | 'YTD' | 'All'`. `StockPricesResponse` bỏ `period`, thêm `interval` + `lookback`.
- **Cảnh báo về ký hiệu "T"**: tầng 1 đề xuất `T = Tuần` xung đột tầng 2 `1T = 1 Tháng`. Đổi tầng 1 dùng `D | W | M` (English ngắn, gọn, giống TradingView). Tầng 2 giữ vi `1T/3T/6T/1N/3N/YTD/Tất cả`, en `1M/3M/6M/1Y/3Y/YTD/All`.
- **Fixture mở rộng** ([`prices-fixture.ts`]): `BASE_DAYS` 250 → 1500 (~6 năm trading days, dư padding cho MA200 ngay cả ở lookback ngắn). Cache theo `${ticker}:${currentPrice.toFixed(2)}` để toggle D ↔ W ↔ M serve aggregation nhất quán.
- **Aggregation D → W/M** ([`prices-fixture.ts`] hàm `aggregate()`): group theo ISO week (W) hoặc YYYY-MM (M). Mỗi bucket: open=first.open, high=max, low=min, close=last.close, volume=sum. Date của bucket = ngày bar cuối trong bucket (chart-friendly).
- **Lookback → tail count** ([`prices-fixture.ts`] hàm `tailCount()`): D = bar count thẳng (1T=22, 3T=66, ..., 3N=750); W = chia 5; M = chia 22; YTD = scan ngược tới Jan 1 năm cuối; All = full (~1250 daily / ~260 weekly / ~60 monthly).
- **MSW handler** ([`handlers.ts`]): parse `?interval=D|W|M&lookback=1T|...|All`. Default `D + 6T`. Validate whitelist → invalid fallback default.
- **Hook** ([`useStockDetail.ts`]): `useStockPrices(ticker, interval, lookback, reloadKey)` → path `?interval=...&lookback=...`.
- **Component** ([`CandlestickChart.tsx`]): props mới `interval`, `lookback`, `onIntervalChange`, `onLookbackChange`. UI: tier 1 segmented pill `D | W | M`, tier 2 row text button 7 lookback.
- **Page** ([`stock-detail/page.tsx`]): 2 useState — đặt tên `candleInterval` thay vì `interval` để tránh shadow `globalThis.setInterval`.
- **i18n**: bỏ namespace `period`, thêm `interval`, `lookback`, `intervalGroup`, `lookbackGroup`.

**Bước 3 — Threshold-5 disable + auto-bump (UX cleanup).**
- **Vấn đề**: M + 1T = 1 bar, vô nghĩa. User nói chỉ là nice-to-have nhưng worth doing vì cost thấp.
- **Constants** ([`CandlestickChart.tsx`]): `MIN_LOOKBACK_BY_INTERVAL = { D: '1T', W: '3T', M: '6T' }` (đảm bảo ≥5 bars). `LOOKBACK_RANK` để compare; YTD/All gán rank 99 ("luôn đủ") vì YTD calendar-dependent và All luôn nhiều bars nhất.
- **Disable**: lookback button có rank < min cho interval hiện tại → `disabled`, opacity 0.35, cursor not-allowed, `title` tooltip "Khoảng quá ngắn cho khung nến này".
- **Auto-bump**: `handleIntervalClick(next)` — nếu lookback hiện < min của interval mới → `onLookbackChange(min)` TRƯỚC `onIntervalChange(next)` để tránh 1 frame render với combo invalid. Vd D + 1T → click M → state update: lookback=6T, interval=M.

**Bước 4 — B1 (MA20/50/200) + B4 (MA volume 20) + crosshair-driven legend.**
- **Type** ([`types.ts`]): thêm `PriceIndicators = { ma20, ma50, ma200, ma_volume_20 }`, mỗi field `(number | null)[]` aligned 1-1 với `bars`. `StockPricesResponse.indicators` field mới.
- **Fixture** ([`prices-fixture.ts`]): hàm `computeSMA(values, period)` chuẩn SMA, null cho `period-1` entry đầu. Tính trên FULL aggregated series TRƯỚC slice tail → window hiển thị thừa hưởng MA "warm" từ padding bars trái nó. Hệ quả: D + 1T (22 bars) vẫn có MA200 từ bar đầu thay vì rỗng 199 bars (nhờ 1500 daily padding).
- **Chart** ([`CandlestickChart.tsx`]):
  - 4 line series mới qua `addLineSeries`: 3 trên price scale (MA20 amber `#f7c948`, MA50 sky blue `#4d96ff`, MA200 pink-red `#ec6090`), 1 trên `priceScaleId='volume'` (MA Vol gray `#9aa4b2`). `priceLineVisible: false`, `lastValueVisible: false`, `crosshairMarkerVisible: false` — không clutter axis/highlight.
  - `repaintIndicators()` setData từng series, skip null entries → lightweight-charts vẽ gap đúng chỗ MA chưa đủ history.
  - Theme repaint cũng re-paint indicators (MA color hard-coded theme-agnostic, nhưng data phải re-set khi candle series re-mount).
- **Toggle state** + **localStorage persist**:
  - State `toggles: { ma20, ma50, ma200, ma_volume_20 }`. Default: MA20+MA50+MA Vol on, **MA200 off** (thường rỗng trên monthly + clutter ở lookback ngắn).
  - Persist key `stock-v2:candlestick-ma-toggles`. Read trên init via lazy `useState(readToggles)`. Write trên mọi toggle change.
  - Apply visibility qua `series.applyOptions({ visible: bool })` (không setData trống — giữ data).
- **Crosshair legend** (top-left chart, floating overlay):
  - `subscribeCrosshairMove(handler)` — đọc `param.time`, tìm bar index, build `LegendSnapshot { date, OHLCV, pctChange, ma20, ma50, ma200 }`.
  - Mouse rời chart → fallback last bar.
  - Bars effect cũng seed legend = last bar ngay từ render đầu (không cần hover).
  - JSX: `position: absolute; top-2 left-2`, 2 hàng:
    - Hàng 1: Date + OHLCV + %change (xanh/đỏ tone). Background semi-transparent (`withAlpha(card-bg, 0.85) + backdrop-filter: blur(2px)`).
    - Hàng 2: 4 chip toggle MA. Active = chấm tròn đầy + opacity 1; inactive = chấm rỗng + opacity 0.45. Click toggle visibility. Hover title: "Hiện đường này" / "Ẩn đường này".
  - `pointer-events-none` outer + `pointer-events-auto` inner → chart vẫn nhận hover mọi nơi trừ chính buttons.
- **B2 skip**: legend top-left đã cover OHLC + MA + %change theo crosshair → thêm floating tooltip cạnh cursor sẽ duplicate + bí chart. User chọn skip.

**Decision points:**
- **MA padding strategy = "backend tính sẵn"** (không phải client compute): cleanest cho real backend sau này. Frontend không phải biết "padding bars". `null` cho bar không đủ history.
- **MA hard-coded hex (không dùng CSS var)**: 4 màu chosen distinct với up/down/S/R, hoạt động tốt trên cả light/dark theme. Nếu sau cần theme-specific MA colors → wrap qua CSS var sau (acceptable trade-off cho hiện tại).
- **Threshold = 5 bars**: M+6T (6 bars) vẫn cho thấy xu hướng nửa năm gần đây, đủ ý nghĩa. Nâng lên 10-12 sẽ chặn quá nhiều combo.
- **Default toggles MA200 off**: monthly aggregate chỉ ~70 bars total → MA200 rỗng hoàn toàn; ở D + lookback ngắn thì MA200 chiếm visual space mà không thêm thông tin → off mặc định, user opt-in khi cần.
- **Cache daily by `${ticker}:${currentPrice.toFixed(2)}`**: cùng ticker + cùng anchor price → cùng daily series → toggle interval cho aggregation nhất quán. Nếu currentPrice đổi (run mới chấm khác) → cache miss → regenerate.

**Verify:** `tsc --noEmit` + `eslint` pass clean. User-side verify (golden path): mặc định D+6T → đổi interval → đổi lookback → toggle MA → reload page (toggle persist) → đổi theme.

**Files touched:**
- `prototype/src/lib/types.ts` (thêm 3 type mới)
- `prototype/src/mocks/data/prices-fixture.ts` (rewrite: BASE_DAYS, aggregate, computeSMA, getOrBuildDaily cache)
- `prototype/src/mocks/handlers.ts` (parse interval+lookback)
- `prototype/src/lib/hooks/useStockDetail.ts` (signature change)
- `prototype/src/components/stock-detail/CandlestickChart.tsx` (rewrite: 2-tier selector, MA series, toggles, crosshair legend)
- `prototype/src/app/(app)/stock-detail/page.tsx` (state + props)
- `prototype/src/messages/{vi,en}.json` (interval, lookback, ma namespace)

**Tác động đến cụm sau (cập nhật §10):**
- Cụm 4 nếu reuse `useStockPrices` cho Price Board mini chart → **bắt buộc đổi signature** sang `(ticker, interval, lookback, reloadKey)`. Đề xuất: mini chart nên fix `interval='D', lookback='1T'` (1 tháng daily) — không cần controls.
- `StockPricesResponse.indicators` shape ổn định, có thể reuse cho bất kỳ nơi nào cần MA pre-computed.
- `MIN_LOOKBACK_BY_INTERVAL` + threshold 5 bars là quy ước UX — nếu cụm sau có chart khác cũng có 2-tier selector thì nên áp dụng cùng logic.
