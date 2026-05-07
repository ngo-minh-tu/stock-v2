# Cluster 5 Summary — Personal & History (Portfolio Lite + Run History + Compare + Backtest)

## 1. Metadata

- **Cluster:** 5 — Personal & History
- **Khoảng ngày:** 2026-05-07 (1 phiên build, sau cluster 4)
- **Commit kết thúc:** sẽ commit cluster 5 độc lập sau audit + báo cáo này.
- **Prompt:** [prompts/cluster-5-personal-history.md](../prompts/cluster-5-personal-history.md)
- **Cluster trước:** `958024c` `feat(prototype): cluster 4 — price board + news & sentiment`.
- **Verify cụm trước:** `npm run build` pass clean trước khi cluster 5 bắt đầu (15 routes, /portfolio và /run-history còn `ComingSoon`).

## 2. Phạm vi

**Dự kiến (theo prompt):**
- Trang `/portfolio` — KPI 4 cards + bảng holdings 12 cột (TanStack) + add/edit/delete modal + empty state
- Trang `/run-history` — KPI 3 cards + bảng runs 11 cột (TanStack) + Compare panel 4 sections + Backtest panel
- 8 MSW handlers mới (portfolio CRUD × 4, runs/{a}/compare/{b}, runs/{id} DELETE, backtest start/status/metrics/results)
- 2 store mới (portfolio, backtest) + 1 compute helper (compare)
- ~14 components mới (portfolio × 3, run-history × 7, backtest × 4)
- 3 hooks mới (`usePortfolio`, `useRunsList`/`useCompare`, `useBacktest`)
- ~110 i18n keys (vi/en)
- Run History KPI block với accuracy backtest ở vị trí thứ 3
- Compare panel chia 4 section: summary diff, recommendation changes, new/removed, score histogram
- Backtest result card với 4 metrics + ROI chart + detail expansion

**Thực tế làm:** đầy đủ scope.

**Mở rộng ngoài prompt (cố ý):**
- **`run_id` DELETE handler** — không có trong prompt §6 nhưng UI §4.5 cần. Implement `DELETE /api/runs/{id}` + `runsStore.delete()` để row Action trong Run History có chỗ gọi.
- **5 field mới cho `RunSummary`** — `model_version`, `settings_version`, `duration_seconds`, `warnings_count`, `avg_score`. Prompt yêu cầu hiển thị 4/5 field đầu trong bảng + dùng cho compare summary section. Thêm như required (additive, RunSelector cluster 2 không bị ảnh hưởng vì chỉ đọc field cũ).
- **Seed runs mở rộng từ 3 → 7** — prompt §6.2 yêu cầu "10 runs (Cụm 2 store + 7 historical)". Tăng seed để mỗi reload luôn có đủ data → bảng Run History đủ density 7+.
- **Backtest detail rows = scored_count của run mới nhất** — prompt §5.3 ghi "81 ticker rows", nhưng `runsStore.computed.results` chỉ có 70-78 mã sau khi loại 4 vòng. Dùng số thực tế (giải thích rõ trong card subtitle "X dự đoán đúng / Y").
- **Compare run_a===run_b validation 400** — bảo vệ thêm ở handler dù UI đã ngăn chọn cùng 1 run.
- **3-way compare toggle** — click run đã selected (A) sẽ shift B → A và clear B; click run đang là B sẽ chỉ clear B. UX gần với pattern "remove from selection".

**Cắt khỏi prompt:**
- **`/api/runs/{id}/results` để render compare** — prompt §6.3 nói "compute on-the-fly từ 2 runs results". Implement compute trực tiếp từ `runsStore.get(a).computed.results` thay vì gọi lại endpoint — đỡ 1 vòng network và đảm bảo strong consistency.
- **Backtest correctness theo PRD §4.5 strict** — mock results dùng heuristic gần đúng (MUA: actualReturn>0; GIU: -7..+12; BAN: actualReturn<0). KHÔNG check outperform VN-Index theo từng row vì mock không track per-ticker VN-Index reference. Acceptable cho prototype UX.
- **Transaction cost / slippage** — Post-MVP per PRD §3.4 + cluster prompt §11.

## 3. File mới

### Mock data layer (3 file)
- [src/mocks/data/portfolio-store.ts](../prototype/src/mocks/data/portfolio-store.ts) — singleton `portfolioStore` (PortfolioStore class) qua `globalThis.__portfolioStore`. Seed 6 holdings (VHM/KDH/NLG/DXG/PDR/KBC) với buy_price + daysAgo phân tán → mix lãi/lỗ. CRUD methods: `list`, `get`, `add`, `update`, `remove`. Anchor `TODAY = '2026-05-07'` cho `ymdFromDaysAgo` để khớp với `news-fixture` + `validateHolding` server-side.
- [src/mocks/data/compare-compute.ts](../prototype/src/mocks/data/compare-compute.ts) — `computeCompare({run_a, run_b})` thuần function. 4 output sections: summary_diff, recommendation_changes (sort upgrade-first → delta magnitude), new_entries / removed (sort score DESC), score_distribution (6 buckets `<30 / 30-45 / 45-60 / 60-75 / 75-90 / ≥90`, low-inclusive high-exclusive). REC_RANK `BAN=0, GIU=1, MUA=2` cho direction detection.
- [src/mocks/data/backtest-store.ts](../prototype/src/mocks/data/backtest-store.ts) — singleton `backtestStore` với state machine 4 transitions (PENDING → RUNNING ×3 → COMPLETED) tổng 8.5s. Final step compute `metrics` (accuracy 0.55-0.75, price_error 8-18%, portfolio_roi 5-25%, vnindex_roi 3-15%, alpha = portfolio − vnindex) + 9-26 weekly ROI curve points + per-ticker results dùng latest run scored_count làm universe. Mulberry32 seed cho determinism.

### Hooks (3 file)
- [src/lib/hooks/usePortfolio.ts](../prototype/src/lib/hooks/usePortfolio.ts) — wrapper trên `useApiResource` cho list + `apiFetch` cho add/update/remove. Manual `reload()` bump reloadKey sau mutate → list re-fetch.
- [src/lib/hooks/useRunHistory.ts](../prototype/src/lib/hooks/useRunHistory.ts) — `useRunsList(limit, offset)` + `useCompare(a, b)`. Compare path = null khi `a===b` hoặc thiếu A/B → useApiResource no-op.
- [src/lib/hooks/useBacktest.ts](../prototype/src/lib/hooks/useBacktest.ts) — 2-stage: `start()` POST → setActiveId; `usePolling` trên `/status` (interval 1.5s, terminal=COMPLETED|FAILED); khi `status==='COMPLETED'` mới fire `/api/backtest/{id}` + `/api/backtest/{id}/results` qua `useApiResource`. `isRunning` derived. `reset()` clear activeId.

### Components — portfolio/ (3 file)
- [src/components/portfolio/PortfolioKPI.tsx](../prototype/src/components/portfolio/PortfolioKPI.tsx) — 4 cards (Total cost, Current value, P&L với hint = pct, Holdings count). PnL color signed: ssi-up/down/stable. Format VND qua `toLocaleString('fr-FR')`.
- [src/components/portfolio/PortfolioTable.tsx](../prototype/src/components/portfolio/PortfolioTable.tsx) — TanStack 12 cột với `HoldingRow` extended interface (joins `PortfolioHolding` + computed price/cost/pnl). Default sort `[pnl_pct DESC]`. Click ticker → `/stock-detail?ticker=X` (no run_id). Cột "Giá hiện tại" dùng `PriceCell` mode dynamic với ceiling/floor/reference từ price-board snapshot. Action cột với edit (Pencil) + delete (Trash2) icons.
- [src/components/portfolio/HoldingFormModal.tsx](../prototype/src/components/portfolio/HoldingFormModal.tsx) — form add/edit dùng chung. Ticker autocomplete qua `<datalist>` từ `STOCK_FIXTURE` (max 8 suggestion). Edit mode disable ticker input. 6 client-side validate rule (ticker required, in fixture, qty>0 integer, price>0, date format, date≤TODAY) + server fallback. ESC close. Auto-focus ticker khi add, save khi edit.
- [src/components/portfolio/DeleteHoldingModal.tsx](../prototype/src/components/portfolio/DeleteHoldingModal.tsx) — confirm modal với `<ticker>` interpolation. ssi-down red button. ESC close.

### Components — run-history/ (7 file)
- [src/components/run-history/RunHistoryKPI.tsx](../prototype/src/components/run-history/RunHistoryKPI.tsx) — 3 cards (Total runs, Last run với relative time + absolute on hover, Avg accuracy backtest). Card 3 hiển thị "—" + hint khi `lastAccuracyPct === null`.
- [src/components/run-history/RunHistoryTable.tsx](../prototype/src/components/run-history/RunHistoryTable.tsx) — TanStack 11 cột. Run ID truncate (run_seed_3 thấy đủ; run_1714999... → run_17…9999). Status outlined badge với màu theo enum. `MiniBars` component cho cột MUA/GIỮ/BÁN: 3 bar SVG-less (3 div fill). Compare action button có visual A/B label khi run đó đang được chọn. Default sort `[run_at DESC]`.
- [src/components/run-history/ComparePanel.tsx](../prototype/src/components/run-history/ComparePanel.tsx) — wrapper aside với 4 section. Hint mode khi chưa đủ A/B (cluster prompt UX guidance). Loading spinner + error message inline.
- [src/components/run-history/CompareSummary.tsx](../prototype/src/components/run-history/CompareSummary.tsx) — bảng 4 cột (Metric / Run A / Run B / Δ) với 6 row. Δ color phụ thuộc `positiveIsGood`: BUY count + Total scored "+ là tốt", SELL count + Duration "+ là xấu", HOLD count = neutral. Format số: int / float (1dp) / mm:ss.
- [src/components/run-history/RecommendationChangesTable.tsx](../prototype/src/components/run-history/RecommendationChangesTable.tsx) — bảng 6 cột với row background highlight: green tint cho upgrade, red tint cho downgrade. RecommendationBadge size sm cho col Run A/B.
- [src/components/run-history/NewRemovedSection.tsx](../prototype/src/components/run-history/NewRemovedSection.tsx) — 2 card grid (md:grid-cols-2). Title: "{count}" interpolated. Empty message khi 0 entry.
- [src/components/run-history/ScoreHistogram.tsx](../prototype/src/components/run-history/ScoreHistogram.tsx) — Recharts BarChart 2 series (`a_count`, `b_count`) với `var(--ssi-up)` + `var(--ssi-info)`. Theme-aware qua CSS vars.
- [src/components/run-history/DeleteRunModal.tsx](../prototype/src/components/run-history/DeleteRunModal.tsx) — pattern y hệt DeleteHoldingModal nhưng có warning para về dữ liệu run.

### Components — backtest/ (4 file)
- [src/components/backtest/BacktestModal.tsx](../prototype/src/components/backtest/BacktestModal.tsx) — 2 date inputs (period_from, period_to) với cross-validation (`max={periodTo}` cho input from, `min={periodFrom}` + `max={TODAY}` cho input to). Default from = TODAY−6mo. Submit error inline.
- [src/components/backtest/BacktestResultCard.tsx](../prototype/src/components/backtest/BacktestResultCard.tsx) — Header với backtest_id + range + correct/total. 4 metric cards (accuracy lớn `text-3xl`, threshold ≥60% green/red; price error neutral; ROI signed; alpha signed với hint "Outperformance"). ChartCard cho ROI curve. Toggle button expand → BacktestDetailTable.
- [src/components/backtest/BacktestRoiChart.tsx](../prototype/src/components/backtest/BacktestRoiChart.tsx) — Recharts LineChart 2 series. Tick formatter `${pct}%`. Tooltip 2dp.
- [src/components/backtest/BacktestDetailTable.tsx](../prototype/src/components/backtest/BacktestDetailTable.tsx) — TanStack 7 cột. Default sort `[error DESC]` (lớn nhất trước → informative). RecommendationBadge sm cho cột "Predicted". Check / X icon cho cột "Correct?".

### Pages (2 file)
- [src/app/(app)/portfolio/page.tsx](../prototype/src/app/(app)/portfolio/page.tsx) — replace ComingSoon. Join holdings × `/api/stocks` snapshot trong `useMemo` để build `HoldingRow[]`. Empty state với button "Add first holding" → cùng modal. Loading spinner. Error card.
- [src/app/(app)/run-history/page.tsx](../prototype/src/app/(app)/run-history/page.tsx) — replace ComingSoon. Compare state (`compareA`, `compareB`) local; toggle handler 4 nhánh (clear A khi click A; clear B khi click B; set A khi rỗng; set B khi A có sẵn). Backtest progress bar inline khi `isRunning`. ResultCard render khi terminal. Delete modal + Backtest modal song song.

## 4. File sửa

- [src/lib/types.ts](../prototype/src/lib/types.ts) — thêm 5 field vào `RunSummary` (model_version, settings_version, duration_seconds, warnings_count, avg_score) + cluster 5 type block (PortfolioHolding/Request, CompareResponse + 4 sub-shapes, BacktestStatus/Metrics/Result/Status types).
- [src/mocks/data/run-compute.ts](../prototype/src/mocks/data/run-compute.ts) — populate 5 field RunSummary mới với default (`baseline_v1`/1/15/0/avg_score). Avg_score = mean(ai_score) trên scored.
- [src/mocks/data/runs-store.ts](../prototype/src/mocks/data/runs-store.ts) — expand seed runs từ 3 → 7 với SEED_SPECS (mix model_version v1/v2, settings_version 1/2, total_capital 300M-750M, daysAgo 1-28, duration 13-24s). Override 5 field summary từ seed spec sau computeRun. Thêm `delete(run_id)` method (cancel timers + remove from order/runs Map). `start()` mặc định v2/2 (production model). `started_at_ms` tracking + duration recalc khi terminal. Active runs trả `duration_seconds = now − started_at_ms` (live).
- [src/mocks/handlers.ts](../prototype/src/mocks/handlers.ts) — thêm 9 handler (4 portfolio CRUD + compare + run delete + 4 backtest). Inline `validateHolding` (SRS f11 AC-11-02..04 + buy_date ≤ TODAY) + `validateBacktest` (period format YYYY-MM-DD + from < to). DELETE responses dùng 200+envelope thay vì 204 (apiFetch parse JSON, không support 204 empty body).
- [src/messages/vi.json](../prototype/src/messages/vi.json) + [src/messages/en.json](../prototype/src/messages/en.json) — thêm 3 namespace mới (`portfolio`, `runHistory`, `backtest`) với ~110 key tiếng Việt + tiếng Anh tương đương. Recommendation labels giữ canonical VIE (`MUA/GIU/BAN`) qua `RecommendationBadge`.
- [src/app/(app)/portfolio/page.tsx](../prototype/src/app/(app)/portfolio/page.tsx) + [src/app/(app)/run-history/page.tsx](../prototype/src/app/(app)/run-history/page.tsx) — replace `ComingSoon` placeholder.

## 5. Refactor / nâng cấp

- **`RunSummary` mở rộng** — additive 5 field. `RunSelector` (cluster 2) không bị ảnh hưởng vì chỉ đọc field cũ. `runs-store.summary()` là 1 trong 2 nguồn duy nhất tạo RunSummary, đã update song song.
- **Seed expansion 3 → 7** — đảm bảo sản phẩm demo có đủ density cho Run History bảng + Dashboard run-selector. Không phải refactor architecture, chỉ data.
- **Pattern store-as-singleton** — portfolio + backtest theo cùng pattern `globalThis.__xxxStore` đã đặt ở runs-store cluster 2. Cluster 6 nếu cần store mới (settings extended) sẽ kế thừa pattern này.

## 6. Quyết định kỹ thuật

- **DELETE response = 200+envelope thay vì 204** — `apiFetch` parse JSON đầu vào nên 204 empty body sẽ throw PARSE_ERROR. Để giữ envelope đồng nhất, return `{success:true, data:{deleted:true}}` với status 200. Trade-off: hơi lệch khỏi spec g02 (DELETE → 204) nhưng UI nhận envelope nhất quán.
- **Compare compute từ runsStore trực tiếp** — không gọi lại `/api/runs/{id}/results` 2 lần như endpoint thật sẽ làm. Lý do: handler chạy trong cùng process, có thể đọc `runsStore.get(a).computed.results` trực tiếp; tránh roundtrip + đảm bảo strong consistency. Trade-off: nếu mai mốt thay MSW bằng backend thật, compare endpoint sẽ phải tự fetch results — không phải concern cluster prototype.
- **Polling backtest 1.5s thay vì 2s như run** — backtest chỉ chạy 8.5s tổng, polling 2s chỉ tick 4 lần → user thấy progress jump 5%→25%→55%→80%→100% quá rời rạc. 1.5s tick 5-6 lần, smooth hơn.
- **Backtest result rows dùng latest run scored_count** — không phải 81 mã (universe) mà là số mã thực sự được scored của run gần nhất (~70-78). Lý do: nếu dùng full 81 thì có MOCK_INSUFFICIENT + các mã bị loại 4 vòng → không có recommendation hợp lệ để compare. Card subtitle ghi rõ `correct/total` để user thấy số thực tế.
- **`positiveIsGood` flag trên CompareSummary** — Δ color không phải lúc nào cũng "+ là tốt": SELL count tăng, Duration tăng đều xấu hơn. HOLD count thay đổi neutral (không ý nghĩa good/bad). Flag này encode trực tiếp logic, đỡ bug "tăng SELL count được tô xanh".
- **Backtest detail default sort `[error DESC]`** — sai số lớn nhất trước (informative cho user analyze model failure). Cluster prompt §5.3 nói "Sort theo error" không nói asc/desc; chọn DESC vì worst-first thường có giá trị xem trước.
- **Compare panel chiếm cột bên phải `xl:col-span-1` (table cột trái 2)** — viewport ≥1280px mới có 2-column layout; nhỏ hơn stack vertical. Compare panel khá tall (4 sections + chart) → on mobile sẽ scroll dài.
- **Recommendation upgrade direction** — REC_RANK `BAN=0, GIU=1, MUA=2` đơn giản nhất; SRS f12 không định nghĩa rõ "upgrade" nên tự đặt rank dựa trên semantic (BUY tích cực hơn HOLD tích cực hơn SELL). UI label legend rõ ràng (BÁN→GIỮ là upgrade).

## 7. Dependencies

**Không thêm gì.** Tất cả sử dụng package đã có ở cluster 1-4: TanStack Table, Recharts, lucide-react, next-intl. Per cluster prompt §2 ("không thêm thư viện").

## 8. Mock data

### Portfolio fixture (cluster 5 mới)
- Seed 6 holdings — VHM/KDH/NLG/DXG/PDR/KBC với mix daysAgo (14-120) và buy_price tạo PnL signed mix.
- Mỗi reload: in-memory store reset (no localStorage). User test CRUD độc lập từng phiên.
- Format: `PortfolioHolding { id, ticker, quantity, buy_price (ngàn đồng), buy_date (YYYY-MM-DD), notes, created_at, updated_at }`.

### Run history fixture (cluster 5 mở rộng)
- 7 historical seed runs trong `runs-store.ts` `SEED_SPECS`. daysAgo 1-28 → run_at trải đều last 30 days. Mix model `baseline_v1` (idx 0-2) + `baseline_v2` (idx 3-6). Settings v1/v2 tương ứng. Outcome 5 success / 2 warnings.
- New runs từ cluster 2 RunButton tự động dùng `baseline_v2` + settings v2.

### Backtest fixture (cluster 5 mới)
- Mock metrics generated on-demand từ `mulberry32(backtest_id*1000 + period_from.length)` → deterministic per backtest_id.
- Accuracy 0.55-0.75, price_error 8-18%, portfolio_roi 5-25%, vnindex_roi 3-15%, alpha derived.
- `roi_curve`: 9-26 weekly points trải đều giữa period_from/period_to. Cumulative %.
- `results[]`: per-ticker rows từ latest run với `predicted_price = target_price_3m`, `actual_price = predicted × (1 ± errPct)`, `recommendation_correct` heuristic theo PRD §4.5.

### Compare fixture (cluster 5 mới)
- 0% mock, 100% computed on-demand từ 2 runs đã có trong store. Pure function, no state.

### Cluster sau dùng cho gì
- Cluster 6 (Settings) sẽ:
  - Cập nhật `model_version`, `settings_version` qua UI thay vì hardcode v2/2 ở `runs-store.start()`.
  - Cluster 5 đã chuẩn hóa các field này trong RunSummary → Cluster 6 chỉ cần wire Settings → runsStore.

## 9. Nợ kỹ thuật / TODO

| Issue | Hoãn vì | Cluster giải quyết |
|---|---|---|
| `runs-store.start()` hardcode `model_version='baseline_v2'`, `settings_version=2` | Settings UI chưa có để pull config | Cluster 6 |
| Compare panel `recommendation_changes` dùng REC_RANK heuristic, không dùng SRS f12 enum chính thức (added_to_buy / removed_from_buy) | SRS f12 không match prompt §4.3 — chọn prompt | Post-cluster 6 nếu cần |
| Backtest correctness không check outperform VN-Index per-ticker (PRD §4.5 strict) | Mock data không track per-ticker VN-Index reference | Backend thật (Phase 4) |
| DELETE → 200+envelope thay vì 204 | apiFetch parse JSON | Sửa khi có HTTP layer thật |
| Portfolio holdings không persist qua reload (in-memory only) | Prompt §6.1 yêu cầu in-memory; backend thật mới có DB | Backend Phase 3 |
| Stop loss column chưa render trong PortfolioTable | Prompt §3.2 không list stop_loss; SRS f11 có derived field nhưng không nói hiển thị | Cluster 6 nếu user cần |
| Compare panel mobile UX (≥4 section dài) | Prototype scope | Cluster 6 polish |
| Backtest second polling tick 1.5s không sync với cluster 2 run polling 2s | Khác workload | OK |

## 10. Ảnh hưởng cluster sau

- **Cluster 6 (Settings)** sẽ cần đọc `model_version` + `settings_version` từ Settings UI → wire vào `runs-store.start()`. Field đã có sẵn trong store.
- **Cluster 6 (Telegram + ngưỡng MUA/GIỮ/BÁN)** dùng cùng `useApiResource` + envelope pattern.
- **Backend Phase 3+** sẽ replace MSW handlers cluster 5; types/contracts đã match TAD g02 + g03 schema. Frontend không cần đổi.
- **Run History "Avg accuracy"** hiện chỉ show accuracy của backtest gần nhất (1 lần). Khi có nhiều backtest, KPI sẽ cần "average across all backtests" — cluster 6 hoặc post-MVP.

## 11. Test thủ công

Dev server: `cd prototype && npm run dev` → mở http://localhost:3000 (hoặc 3001 nếu :3000 đang dùng).

### Portfolio
- **URL:** `/portfolio`
- **Golden path:**
  1. Load → 4 KPI card + bảng 6 holding (VHM/KDH/NLG/DXG/PDR/KBC). Sort default theo "Lãi/lỗ %" DESC.
  2. Cột "Giá hiện tại" tô màu TTCK 5-color (so với reference từ price-board snapshot).
  3. Click "+ Thêm mã" → modal mở. Nhập ticker `KBC` → datalist gợi ý "Kinh Bắc City". Quantity 100, buy_price 35.5, buy_date 2026-04-01 → Submit → toast "Đã thêm mã" + bảng update.
  4. Click icon Pencil ở row VHM → modal Edit (ticker disabled). Đổi quantity → Save → toast "Đã cập nhật".
  5. Click icon Trash đỏ → confirm modal "Xóa VHM khỏi danh mục?" → Xóa → toast.
  6. Click ticker text (VHM) → navigate `/stock-detail?ticker=VHM`.
- **Edge cases:**
  - Xóa hết 6 holding → empty state "Chưa có mã nào trong danh mục" + button "Thêm mã đầu tiên".
  - Nhập ticker không có trong fixture (`AAA`) → server reject "Mã AAA không có trong whitelist."
  - Quantity = 0 hoặc -1 → client reject "Số lượng phải là số nguyên dương."
  - buy_date = mai → date picker max = TODAY ngăn user chọn; nếu submit raw → server reject.
  - Notes dài >50 char → tooltip on hover.

### Run History
- **URL:** `/run-history`
- **Golden path:**
  1. Load → 3 KPI card + bảng 7 run seed. Sort default theo "Thời gian" DESC.
  2. Cột "MUA/GIỮ/BÁN" hiển thị 3 mini bar + số đếm.
  3. Cột "Cảnh báo" badge `2` cho 2 run warnings; "—" cho 5 run success.
  4. Click icon `↗` (View) ở 1 row → navigate `/?run_id=run_seed_3` (Dashboard load run đó).
  5. Click icon `⇆` (Compare) ở row 1 (run_seed_7) → label "A" hiện. Compare panel show hint "Đã chọn run A. Bấm icon so sánh trên 1 run khác…".
  6. Click icon `⇆` ở row 2 (run_seed_6) → label "B". Panel render 4 section: Summary diff + Recommendation changes + New/Removed + Score histogram.
  7. Verify upgrade row (background xanh nhạt) khi ticker có rec đổi BÁN→GIỮ hoặc GIỮ→MUA.
  8. Verify downgrade row (background đỏ nhạt).
  9. Click X ở compare panel → clear selection.
  10. Click icon `🗑` (Delete) → confirm modal → Xóa → row biến mất + KPI total runs giảm.

### Backtest
- **URL:** `/run-history` (cùng trang)
- **Golden path:**
  1. Click "Run Backtest" header → modal. Default period_from = TODAY-6mo. period_to = TODAY.
  2. Chỉnh range → Submit → modal close + toast "Đã bắt đầu backtest".
  3. Section "Kết quả Backtest" xuất hiện với progress bar đổi 5%→25%→55%→80%→100% (~8.5s tổng).
  4. Sau COMPLETED: card với 4 metric (accuracy lớn, price_error, portfolio_roi/vnindex_roi, alpha). Accuracy ≥60% xanh, <60% đỏ.
  5. ROI chart: 2 line series (Portfolio xanh ssi-up, VN-Index xanh dương ssi-info). Gap giữa 2 line ≈ alpha.
  6. Click "Xem chi tiết X mã" → bảng 7 cột mở rộng. Default sort theo error DESC. Cột "Đúng?" check/X icon.
  7. Click ngược lại → ẩn detail.
- **Edge cases:**
  - period_from ≥ period_to → client reject "Ngày bắt đầu phải trước ngày kết thúc."
  - period_to > TODAY → date picker max ngăn.
  - Đang backtest mà bấm "Run Backtest" → button disabled với label "Đang backtest…".
  - Empty (chưa có run nào) → button disabled với title "Cần ít nhất 1 run hoàn thành để chạy backtest."

### Theme + i18n
- Switch theme qua Header dropdown (Classic Dark/Light, Light, OLED) → cả 3 trang phối lại màu (CSS vars). Recharts SVG re-paint.
- Switch language vi → en qua Settings → tất cả label cluster 5 đổi sang tiếng Anh (portfolio.* / runHistory.* / backtest.*). RecommendationBadge label đổi MUA/GIỮ/BÁN → BUY/HOLD/SELL.

### Regression check (cluster 1-4)
- `/`, `/top-mua`, `/red-flags`, `/stock-detail?ticker=KDH`, `/price-board`, `/news`, `/settings` — tất cả 200, render ổn. Cluster 2 RunSelector trên Dashboard list 7 seed run + n run mới.
- Run mới (Header → Chạy → Submit capital) → run_id mới xuất hiện trên `/run-history` ở top sau ~15s.
