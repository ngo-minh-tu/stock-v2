# Cluster 2 Summary — Screening Flow (Run + Dashboard + Top MUA + Red Flags)

## 1. Metadata

- **Cluster:** 2 — Screening Flow
- **Khoảng ngày:** 2026-05-06 → 2026-05-07 (xong cụm 1 cùng ngày, finalize cụm 2 đến ngày kế)
- **Commit kết thúc:** **Chưa commit** — toàn bộ thay đổi cụm 2 vẫn ở working directory (15 modified + 19 untracked, ~1339 dòng thêm). Cần commit trước khi bắt đầu cụm 3.
- **Prompt:** [prompts/cluster-2-screening-flow.md](../prompts/cluster-2-screening-flow.md)
- **Cluster trước:** `4718c95` `feat(prototype): cluster 1 — shell & foundation`

## 2. Phạm vi

**Dự kiến (theo prompt):** RunButton + polling, modal capital, RunStatusCard, Dashboard 6 visual + KPI + run selector, Top MUA table với expand row, Red Flags 2 sections, MSW state-machine simulation, mock outcome toggle, mock 81 mã.

**Thực tế làm:** đầy đủ scope dự kiến.

**Mở rộng ngoài prompt (cố ý):**
- Toast system riêng (`ToastContext` + `ToastViewport`) — prompt nói "toast success" nhưng không nêu phải tự build; chọn build vì cần consistent tone cho 4 outcome.
- `MockOutcomePicker` đặt ngay trong Settings page làm 1 section thay vì URL param duy nhất — prompt §7.2 cho phép cả "URL param HOẶC UI button trong Settings".
- `apple-icon.tsx` + `icon.tsx` (favicon/PWA touch icon) — không trong prompt, thêm để tab browser/devtools dễ phân biệt.

**Không cắt mục lớn nào.** Outcome `conflict` được implement qua 2 đường: server-driven (đã có run đang chạy → 409 tự nhiên) + URL param `?outcome=conflict` để force test khi không có run nào.

## 3. File mới

### Mock data layer
- [src/mocks/data/runs-store.ts](../prototype/src/mocks/data/runs-store.ts) — singleton `RunsStore` lưu in-memory; state machine 5 step với `setTimeout`; seed sẵn 3 historical run; expose `start/get/list/latest/dashboard/summary/activeJob`
- [src/mocks/data/run-compute.ts](../prototype/src/mocks/data/run-compute.ts) — pure compute từ fixture → `ComputedRun` (results + excluded + summary + dashboard); dùng mulberry32 PRNG để reproducible
- [src/mocks/data/stocks-fixture.ts](../prototype/src/mocks/data/stocks-fixture.ts) — 81 mã (26 thật + 5 anchor `MOCK_BUY_STRONG/BUY_WARN/HOLD/SELL/INSUFFICIENT` + 50 filler) + 13 reason templates kèm `feature_id`

### Components — run lifecycle
- [src/components/run/RunButton.tsx](../prototype/src/components/run/RunButton.tsx) — primary button mở `CapitalModal` rồi gọi `startRun` với outcome hiện tại
- [src/components/run/CapitalModal.tsx](../prototype/src/components/run/CapitalModal.tsx) — modal nhập tổng vốn (default 500M, format `fr-FR`), checkbox "skip allocation", ESC + click-outside để close
- [src/components/run/RunStatusCard.tsx](../prototype/src/components/run/RunStatusCard.tsx) — sticky progress card dưới Header; status badge + step text + progress bar; nút Cancel disabled (TAD MVP)
- [src/components/run/RunSelector.tsx](../prototype/src/components/run/RunSelector.tsx) — dropdown 10 run gần nhất, label `dd/MM/yy HH:mm — N mã`

### Components — charts (6 files)
- [src/components/charts/ChartCard.tsx](../prototype/src/components/charts/ChartCard.tsx) — wrapper card title + height + helper `recommendationColor()` shared
- [src/components/charts/TreemapChart.tsx](../prototype/src/components/charts/TreemapChart.tsx) — Recharts Treemap, `CustomCell` render label theo width/height
- [src/components/charts/PieChart.tsx](../prototype/src/components/charts/PieChart.tsx) — donut MUA/GIỮ/BÁN
- [src/components/charts/LineChart.tsx](../prototype/src/components/charts/LineChart.tsx) — VN-Index + BĐS Index 26 tuần
- [src/components/charts/BarChart.tsx](../prototype/src/components/charts/BarChart.tsx) — top 10 by AI score, fill theo recommendation
- [src/components/charts/RadarChart.tsx](../prototype/src/components/charts/RadarChart.tsx) — 5 nhóm features (fundamental, technical, macro, realestate, sentiment)

### Components — dashboard / tables / badges
- [src/components/dashboard/DashboardGrid.tsx](../prototype/src/components/dashboard/DashboardGrid.tsx) — 5 ChartCard layout 1/2 columns (Treemap full, Pie+Radar 2-col, Line+Bar full)
- [src/components/dashboard/KPICards.tsx](../prototype/src/components/dashboard/KPICards.tsx) — 5 KPI cards (totalScored, MUA, GIỮ, BÁN, alpha vs VN-Index)
- [src/components/tables/TopMuaTable.tsx](../prototype/src/components/tables/TopMuaTable.tsx) — TanStack Table; sort/filter/expand row; deep-link `/stock-detail?run_id=X&ticker=Y`
- [src/components/tables/RedFlagsExcludedTable.tsx](../prototype/src/components/tables/RedFlagsExcludedTable.tsx) — section A; filter theo round (1-4) + reason_code
- [src/components/tables/RedFlagsBadgesTable.tsx](../prototype/src/components/tables/RedFlagsBadgesTable.tsx) — section B; filter theo badge type
- [src/components/badges/RecommendationBadge.tsx](../prototype/src/components/badges/RecommendationBadge.tsx) — pill MUA/GIỮ/BÁN dùng `--ssi-up/ref/down`
- [src/components/badges/EntrySignalChip.tsx](../prototype/src/components/badges/EntrySignalChip.tsx) — 7 entry signal grouped 3 tone (buy/wait/none)
- [src/components/badges/WarningBadge.tsx](../prototype/src/components/badges/WarningBadge.tsx) — 4 warning với icon AlertTriangle, màu cam thống nhất

### Components — common
- [src/components/common/ToastViewport.tsx](../prototype/src/components/common/ToastViewport.tsx) — fixed top-right, render danh sách toast từ `useToast()`
- [src/components/settings/MockOutcomePicker.tsx](../prototype/src/components/settings/MockOutcomePicker.tsx) — segmented buttons `success | warnings | failed | conflict` cho dev test

### Contexts (3 mới)
- [src/contexts/RunContext.tsx](../prototype/src/contexts/RunContext.tsx) — `activeRunId`, `lastCompletedRunId`, `startRun`, polling auto qua `usePolling`; toast + auto-dismiss (3s success/warnings, 4s failed); `handledRunRef` chống double-fire
- [src/contexts/ToastContext.tsx](../prototype/src/contexts/ToastContext.tsx) — `push({kind, title, message})` + auto-dismiss 4s; counter ref tránh stale id
- [src/contexts/MockOutcomeContext.tsx](../prototype/src/contexts/MockOutcomeContext.tsx) — outcome state persist `localStorage[mock_run_outcome]`, default `success`

### Hooks (2)
- [src/lib/hooks/useApiResource.ts](../prototype/src/lib/hooks/useApiResource.ts) — `useApiResource<T>(path, reloadKey)` GET-once + refresh; cancel-on-unmount; tránh pull SWR
- [src/lib/hooks/usePolling.ts](../prototype/src/lib/hooks/usePolling.ts) — `usePolling<T>(path, {intervalMs, isTerminal, enabled})`; `cancelledRef` block update sau unmount

### Branding (ngoài prompt)
- [src/app/icon.tsx](../prototype/src/app/icon.tsx) — favicon 32×32 "VN" (Next.js `ImageResponse`)
- [src/app/apple-icon.tsx](../prototype/src/app/apple-icon.tsx) — apple-touch-icon 180×180

## 4. File sửa

- [src/app/layout.tsx](../prototype/src/app/layout.tsx) — lồng thêm 4 provider (`ToastProvider` → `MockOutcomeProvider` → `AuthProvider` → `RunProvider`) + `<ToastViewport />` cuối tree. Why: cần state share giữa Header (RunButton), AppShell (RunStatusCard), Dashboard (lastCompletedRunId).
- [src/components/layout/AppShell.tsx](../prototype/src/components/layout/AppShell.tsx) — chèn `<RunStatusCard />` ngay dưới `<Header />`. Why: progress card phải sticky bám header trên mọi page sau login.
- [src/components/layout/Header.tsx](../prototype/src/components/layout/Header.tsx) — thêm `<RunButton />` bên trái theme/locale. Why: prompt §3.1 "đặt ở Header (bên trái theme/locale)".
- [src/components/common/MswBootstrap.tsx](../prototype/src/components/common/MswBootstrap.tsx) — chuyển dynamic `import('msw/browser')` vào trong `useEffect` (Promise.all import song song với handlers); thêm option opt-in qua `NEXT_PUBLIC_ENABLE_MSW=1`. Why: `msw/browser` exports `{"node": null}` — nếu top-level import sẽ fail server bundle khi chạy `next build`.
- [src/lib/constants.ts](../prototype/src/lib/constants.ts) — thêm enums: `RUN_STATUS`+`RUN_TERMINAL_STATES`, `RECOMMENDATIONS`, `ENTRY_SIGNALS`, `WARNING_BADGES`, `ExcludedRound`+`EXCLUDED_REASONS`, `MOCK_RUN_OUTCOMES`+`MOCK_RUN_OUTCOME_KEY`. Why: source-of-truth duy nhất cho tất cả components, mirror SRS/TAD.
- [src/lib/types.ts](../prototype/src/lib/types.ts) — thêm `RunStartRequest/Response`, `RunStatusResponse`, `RunWarning`, `ScreeningReason`, `ScreeningResult`, `ExcludedStock`, `RunResultsResponse`, `RunSummary`, `RunsListResponse`, `DashboardResponse`. Why: shapes API cụm 2 (TAD g01 + g02 §4 + c05).
- [src/mocks/handlers.ts](../prototype/src/mocks/handlers.ts) — thêm 6 handler `POST /api/run` (202/409), `GET /api/runs`, `GET /api/runs/:id/{status,results,dashboard}`, `GET /api/runs/:id`. Why: state machine + lifecycle theo prompt §7.1.
- [src/messages/{vi,en}.json](../prototype/src/messages/) — thêm ~176 dòng mỗi file: keys `run.*`, `dashboard.*`, `topMua.*`, `redFlags.*`, `entry.signal.*`, `warning.*`, `recommendation.*`, `header.*`, `settings.mockOutcome.*`. Why: convention bilingual mọi key.
- [src/app/(app)/page.tsx](../prototype/src/app/(app)/page.tsx) — replace `<ComingSoon clusterNumber={2} />` bằng Dashboard thật (empty state + grid). Why: cụm này fill placeholder.
- [src/app/(app)/top-mua/page.tsx](../prototype/src/app/(app)/top-mua/page.tsx) — replace placeholder bằng load `RunResultsResponse` + render `<TopMuaTable>`.
- [src/app/(app)/red-flags/page.tsx](../prototype/src/app/(app)/red-flags/page.tsx) — replace placeholder bằng 2 section (excluded + warnings).
- [src/app/(app)/settings/page.tsx](../prototype/src/app/(app)/settings/page.tsx) — thêm 1 section "Mock Outcome" (MockOutcomePicker) + 1 card "Coming in cluster 6" (Construction icon). Why: prompt §7.2 cho phép UI toggle, đồng thời chính thức ghi nhận các sub-section còn thiếu.

## 5. Refactor / nâng cấp

- **Header được "khai báo lại layout"**: cụm 1 chỉ có brand + theme + locale + logout; cụm 2 chèn `<RunButton>` đứng đầu nhóm bên phải. Đây là điểm extension chính cho cụm 3+ — cluster 6 sẽ thêm export shortcut tại cùng vị trí.
- **`MswBootstrap` chuyển sang lazy + gate render**: trước đây children render ngay, giờ block tới khi worker `start()` xong → loại bỏ race ban đầu khi `apiFetch` bắn trước MSW ready (mới xảy ra rõ với polling cụm 2).
- **Provider stack mở rộng**: từ 4 lớp (MSW → Locale → Theme → Auth) lên 7 lớp. Thứ tự cố định: `ToastProvider` đặt ngoài `RunProvider` (Run cần `useToast`); `MockOutcomeProvider` đặt ngoài `AuthProvider` (toggle phải tồn tại trước khi login); `RunProvider` trong cùng để hooks/components gọi `useRun` từ mọi page.
- **Constants/types mở rộng đáng kể**: file `constants.ts` từ 57 dòng → 116 dòng; `types.ts` từ 57 → 192 dòng. Đây là lúc lock shape cho 4 cụm còn lại.

## 6. Quyết định kỹ thuật

- **Singleton store qua `globalThis.__runsStore`** (runs-store.ts): MSW handler là module re-imported giữa request — phải dùng `globalThis` cache để mọi handler trong cùng 1 tab share state. Thay thế cho prompt §7.1 yêu cầu "in-memory store, singleton module". Lý do `globalThis`: Next.js dev server có thể HMR re-import handler module nhưng giữ tab → tránh mất state run đang chạy.
- **mulberry32 PRNG + per-ticker seed** (run-compute.ts): KHÔNG dùng `Math.random()`. Lý do: 2 lần reload với cùng `master_seed` ra cùng results → screenshot/demo reproducible; per-ticker seed (`master_seed + seed`) giữ tính chất riêng từng mã ổn định.
- **5 mã anchor deterministic ghi đè PRNG**: `MOCK_BUY_STRONG=92`, `MOCK_BUY_WARN=78+1 badge`, `MOCK_HOLD=55`, `MOCK_SELL=30+2 badges`, `MOCK_INSUFFICIENT` excluded. Lý do: TAD g06 §22 yêu cầu test fixture phải predictable; demo luôn có ít nhất 1 ticker mỗi recommendation cluster.
- **Recharts thay vì Highcharts/D3**: theo TAD §2 + prompt §2. ResponsiveContainer + nhẹ ~60KB; tradeoff là Treemap label tự render qua `CustomCell` SVG vì built-in label kém.
- **Charts fill bằng CSS variable strings (`var(--ssi-up)`) thay vì hex**: SVG `fill="var(...)"` được trình duyệt resolve theo `[data-theme]` cha, không cần re-render. Lý do: theme switch không cần reload chart.
- **Custom `usePolling` hook** thay vì SWR: cụm 2 chỉ cần 1 endpoint polling; thêm SWR là bloat. `cancelledRef` pattern + functional setState với captured run id để chống late-fire timer của run A xóa state run B.
- **`useRef` thay `useState` cho `handledRunRef`** trong `RunContext`: đây là "đã fire toast cho run này chưa" — nếu để state, effect deps thay đổi → tự re-run → clear setTimeout của chính nó trước khi auto-dismiss.
- **Auto-dismiss timer dùng functional setState comparing captured id**: `setActiveRunId((prev) => prev === capturedRunId ? null : prev)` — chống case run A timer fire sau khi đã start run B.
- **Outcome `conflict` có 2 đường vào**: (a) URL param `?outcome=conflict` (force test khi không có run đang chạy) (b) tự nhiên qua `runsStore.activeJob()`. Lý do: prompt yêu cầu test 4 case riêng biệt; conflict tự nhiên hiếm khi reproduce demo.
- **Chỉ 1 toast type bằng màu cam (#f49f3b) cho warning**: hardcoded thay vì CSS var — bù lại 4 theme đều có contrast OK với màu này; warning là màu chuyên dụng, không bị ảnh hưởng theme switch (giống brand alert color).
- **`onUnhandledRequest: 'bypass'`** trong MSW worker: cho phép Next.js dev server fetch HMR/_next/* asset; catch-all `/api/*` của handlers vẫn cover endpoint chưa mock.
- **Gate render con bằng `MswBootstrap`** (set `ready` sau worker.start): trước cụm 2 không có vì chỉ Auth init gọi API; cụm 2 polling có thể fire ngay → phải đợi worker ready.
- **Reload key qua `lastCompletedRunId` listener**: cả Dashboard, TopMUA, RedFlags đều `useEffect` bump local `reloadKey` khi `lastCompletedRunId` đổi → re-fetch tự động khi run mới xong, không cần manual refresh.

## 7. Dependencies

**Thêm mới (deps):**
- `@tanstack/react-table@^8.20.5` — bảng sort/filter/expand cho Top MUA + Red Flags (TAD §2).
- `recharts@^2.13.0` — 5/6 visual Dashboard.

**Bỏ / upgrade:** không có.

**Không thêm dù prompt gợi ý:** SWR — `usePolling`/`useApiResource` tự viết đủ dùng.

## 8. Mock data

Shape & file nguồn cho cụm sau tham khảo:

- **Run record** ([runs-store.ts](../prototype/src/mocks/data/runs-store.ts)): `RunRecord = { run_id, run_at, status, progress_percent, current_step, warnings[], run_error, total_capital, outcome, computed: ComputedRun | null, timers[] }`.
- **Computed run** ([run-compute.ts](../prototype/src/mocks/data/run-compute.ts)): `ComputedRun = { results: ScreeningResult[], excluded: ExcludedStock[], summary, dashboard, total_capital }`.
- **Stock seed** ([stocks-fixture.ts](../prototype/src/mocks/data/stocks-fixture.ts)): 81 entries `{ ticker, name, exchange, sector, seed }`. 26 ticker BĐS thật + 5 mock anchor + 50 filler `MOCK01..MOCK50`. Cụm 3 đọc 1 ticker từ đây.
- **Reason templates** ([stocks-fixture.ts](../prototype/src/mocks/data/stocks-fixture.ts)): 13 mẫu kèm `feature_id` (F0x/T0x/M0x/R0x/S0x) — KHÔNG LLM-generate (GUARD-02). Cụm 3 nên reuse cho stock detail.
- **Seed runs**: 3 historical run pre-seeded lúc store init (`run_seed_1/2/3`), 1 run có `outcome: 'warnings'` để Red Flags page demo có data ngay khi mới load.

## 9. Nợ kỹ thuật / TODO

- **Cụm 2 chưa được commit** — toàn bộ thay đổi đang ở working dir. Cần commit trước cụm 3, hoặc có thể bị overwrite/lost.
- **Auto-dismiss của RunStatusCard chưa user-confirmed** trên 4 outcome (đã liệt kê trong memory). Cần manual test cụm 3 trước khi assume nó đúng.
- **Theme switch trên Recharts SVG đã render**: lý thuyết qua CSS var sẽ đúng nhưng chưa user-verify trên đồ thị đang hiển thị; có rủi ro Recharts cache màu nếu `isAnimationActive` không tắt (đã tắt cho Treemap/Bar/Radar, chưa tắt Pie/Line — theo dõi cụm sau).
- **Treemap render time với 81 cell** chưa profile (prompt acceptance #10 yêu cầu < 500ms).
- **Mobile/tablet** với table horizontal scroll + treemap shrink: chưa test thiết bị thật.
- **`current_price` được lưu là "ngàn đồng"** (e.g. 32.5 = 32 500 VND): convention không nhất quán với `market_cap` (tỷ đồng) và `allocation_amount` (đồng). Cụm 3 (Stock Detail) cần thống nhất hoặc thêm helper `formatPrice`/`formatVnd`.
- **`/api/runs/:id` summary** trả khi run chưa COMPLETED có `scored_count = 0` — cụm 5 (Run History) cần lưu ý hiển thị trạng thái loading.
- **Outcome `conflict` qua URL param hơi clunky**: tốt hơn là `MockOutcomePicker` set thẳng outcome rồi MSW xử lý — hiện tại nếu pick `conflict` mà không có run đang chạy, vẫn cần phải bắn `?outcome=conflict` (hiện đã wire qua context: `RunContext.startRun → /api/run?outcome=conflict`). Đúng nhưng không tự documenting; cluster 6 nếu refactor settings nên ghi rõ trong UI.

## 10. Ảnh hưởng cluster sau

- **Cluster 3 (Stock Detail) — phụ thuộc trực tiếp:**
  - Reuse `useApiResource` đọc `/api/runs/{id}/stocks/{ticker}` (chưa mock — sẽ là handler đầu tiên cụm 3 thêm). Nguồn data: `runsStore.get(run_id).computed.results.find(r => r.ticker === ticker)`.
  - URL deep-link đã set `/stock-detail?run_id=X&ticker=Y` — ĐỪNG đổi shape này (TopMuaTable expand link).
  - `ScreeningResult` đã có `radar` 5-axis — Stock Detail dùng cho radar zoom-in cấp ticker.
  - Reuse `RecommendationBadge`, `EntrySignalChip`, `WarningBadge` — cùng theme, cùng i18n keys.
  - `ChartCard.recommendationColor()` helper extend được cho candlestick (Lightweight Charts mới install ở cụm 3).
  - `lastCompletedRunId` từ `RunContext` — Stock Detail listen để invalidate khi run mới xong.
- **Cluster 4 (Market & Browse):** Price Board dùng `--ssi-up/down/ceil/floor/ref/stable` đã có; News dùng pattern `useApiResource` + filter pattern từ Red Flags table.
- **Cluster 5 (Personal & History):** Run History list trực tiếp `runsStore.list()`; cần thêm DELETE handler nếu prompt yêu cầu xóa run. Portfolio đọc `r.computed.results.filter(rec === 'MUA')` từ mọi run.
- **Cluster 6 (Export & Integrations):** Settings page đã có 4 section (theme, language, mockOutcome, comingSoon card) — cụm 6 thêm sources/telegram/threshold/password vào cùng pattern `card p-6`.

## 11. Test thủ công

| Bước | URL / Action | Kỳ vọng |
|---|---|---|
| 1 | `npm install` (lần đầu sau khi pull deps mới) → `npm run dev` → login | Header có nút "Chạy" bên trái theme/locale; Dashboard `/` hiện 3 historical run trong selector |
| 2 | `/` (Dashboard) | Load run mới nhất (`run_seed_3`); 5 KPI + Treemap + Pie + Radar + Line (VN-Index + BĐS) + Bar top 10 |
| 3 | Click Run → modal → submit 500M | Modal đóng; RunStatusCard sticky dưới header; tự chuyển 5 state trong ~15s; toast "Run hoàn thành"; Dashboard reload run mới |
| 4 | `/settings` → Mock Outcome chọn `failed` → Run lại | RunStatusCard chuyển FAILED + viền đỏ; toast error 4s |
| 5 | Settings → Mock Outcome `warnings` → Run | Toast warning + Dashboard load với run vẫn có data + RedFlags page hiện warnings |
| 6 | Settings → Mock Outcome `conflict` → Run | Toast warning "Đang có tác vụ chạy" — KHÔNG tạo run mới |
| 7 | Trong khi run đang chạy click Run lại | 409 toast (server-side conflict tự nhiên) |
| 8 | `/top-mua` | Sort default AI Score DESC; chỉ hiện rec=MUA; search "VHM" → 0 hoặc 1 row tùy run; click ticker expand → reasons + buy/stop/allocation + warnings; click "Xem chi tiết" → `/stock-detail?run_id=…&ticker=VHM` (page Cụm 3 placeholder) |
| 9 | `/red-flags` | Section A "Mã bị loại" filter round/reason; Section B "Cảnh báo" filter badge type; ít nhất `MOCK_INSUFFICIENT` luôn xuất hiện ở Section A |
| 10 | Đổi theme dropdown 4 lần khi đang ở `/` | KPI colors + Pie/Treemap/Bar đổi ngay; Line VN-Index đổi (Pie/Line chưa tắt animation, kiểm tra có flicker không) |
| 11 | Run selector dashboard → chọn run cũ | Toàn bộ 6 visual reload đúng run đó |
| 12 | F5 trong lúc run đang chạy | RunStatusCard mất (state in-memory không persist) — đây là behavior hiện tại; backend thật sẽ resume |
| 13 | Mobile viewport (≤640px) | Sidebar drawer; RunButton chỉ icon (label ẩn `sm:hidden`); table horizontal-scroll; KPI 2 cols thay vì 5 |
| 14 | DevTools Network tab | `/api/runs?limit=10`, `/api/runs/:id/dashboard`, `/api/runs/:id/results`, `/api/runs/:id/status` (mỗi 2s khi đang run) |
| 15 | `npm run build` + `npm run lint` | Pass TypeScript strict + ESLint clean |

## 12. Post-cluster fixes

### Fix #1 — Tooltip Treemap không đọc được trên dark theme (2026-05-08)

**Triệu chứng:** Hover vào ô Treemap ở trang Dashboard, tooltip popup hiển thị mã/điểm/vốn hóa nhưng nền trong suốt — chữ trắng "trôi" trên màu cell, gần như không nhìn được. Lỗi xuất hiện trên cả `oled` và `classic-dark`. Trên `light` / `classic-light` triệu chứng nhẹ hơn vì chữ tooltip đã là dark trên surface trắng.

**Root cause:** Biến CSS `--color-theme-tooltip-background` được dùng ở 8 component (TreemapChart, BarChart, LineChart, PieChart, RadarChart, BacktestRoiChart, ScoreBreakdown, ScoreHistogram) nhưng **chưa từng được định nghĩa** trong `themes.css` ở bất kỳ theme nào → fallback về `unset` → trong suốt. Đây là gap có từ cluster 1 (themes.css gốc) nhưng chỉ lộ rõ khi cluster 2 đưa Treemap vào dashboard, và tệ hơn ở cluster 3+ với nhiều chart hơn.

**Fix:**
1. `prototype/src/styles/themes.css` — thêm `--color-theme-tooltip-background` + `--color-theme-tooltip-border` vào cả 4 theme:
   - `classic-dark`: `rgba(20,18,32,0.96)` + border `rgba(255,255,255,0.10)`
   - `oled`: `rgba(10,10,10,0.96)` + border `rgba(255,255,255,0.14)` (gần pure black, viền sáng hơn để pop trên nền OLED đen tuyền)
   - `light` & `classic-light`: `rgba(255,255,255,0.98)` + border `rgba(0,0,0,0.10)`
2. `prototype/src/components/charts/TreemapChart.tsx` — nâng styling tooltip popup theo spec:
   - Padding `8px 12px` (thay `px-2.5 py-1.5`)
   - `border: 1px solid var(--color-theme-tooltip-border)` (mới — thêm chiều sâu)
   - `shadow-lg` (thay `shadow-md`)
   - `rounded-md` + `backdrop-filter: blur(2px)`
   - Ticker bump lên `text-sm` cho dễ scan

**Tác dụng phụ tốt:** Vì sửa ở tầng CSS variable, tất cả 8 component cùng dùng biến này (BarChart, LineChart, PieChart, RadarChart, BacktestRoiChart, ScoreBreakdown trong cluster 3, ScoreHistogram trong cluster 5) đều tự động hết bệnh tooltip trong suốt — không cần touch từng file.

**Verify:** `npx tsc --noEmit` pass clean. ESLint không có warning trên file đã sửa (.css parse error là noise irrelevant của eslint default parser).

**File touched:** `prototype/src/styles/themes.css`, `prototype/src/components/charts/TreemapChart.tsx`.

**Iteration 2 (cùng ngày, sau user feedback):** Đồng bộ màu tooltip theo recommendation — dùng pattern y hệt Pie center label (Fix #3). Set `color: recommendationColor(d.recommendation)` trên wrapper div thay vì chỉ ở dòng "BAN · 30" → cả 3 dòng (ticker / recommendation+score / vốn hóa) cùng màu xanh-MUA / vàng-GIỮ / đỏ-BÁN. Dòng cuối giữ `opacity: 0.85` cho hierarchy. File touched: `TreemapChart.tsx`.

### Fix #2 — Pie chart "Tỷ lệ khuyến nghị" chữ % đen trên nền OLED/classic-dark (2026-05-08)

**Triệu chứng:** Donut chart MUA/GIỮ/BÁN ở Dashboard render nhãn `%` (vd "14%", "29%") với màu mặc định của recharts → trên `oled` (#000) và `classic-dark` (#020210) chữ gần như tàng hình. Legend ở dưới dùng `--color-theme-text-primary` = `#c1c1c1`, đọc được nhưng contrast chưa cao.

**Root cause:** Code cũ truyền `label={({ value }) => '...%'}` — recharts wrap string return value vào `<text>` với fill mặc định (hardcode `#666`/đen tùy version), KHÔNG inherit theme color. Đây là pattern phổ biến mọi recharts pie label đều dính nếu không tự render SVG.

**Fix:** [PieChart.tsx](prototype/src/components/charts/PieChart.tsx)
1. Thay `label` string-returning function bằng custom SVG `<text>` renderer (`renderLabel`) đặt `fill="var(--color-theme-text-tertiary)"` → trắng (#ffffff) ở dark, đen (#1e2329) ở light, tự đổi theo theme.
2. Position label OUTSIDE donut tại `radius = outerRadius + 14` với `textAnchor` động (`start` nếu nằm phải tâm, `end` nếu trái) — đúng yêu cầu user "nhãn % bên ngoài segment phải đọc được".
3. Hide label cho slice < 4% (tránh chồng nhãn khi 1 nhóm rất nhỏ).
4. Giảm `innerRadius` 55%→50% và `outerRadius` 80%→72% để chừa chỗ cho label outside, tránh clip edge card.
5. Bump Legend từ `--color-theme-text-primary` (#c1c1c1) → `--color-theme-text-tertiary` (#ffffff dark / #1e2329 light) cho contrast tối đa.
6. Tooltip thêm `border: 1px solid var(--color-theme-tooltip-border)` + `borderRadius: 6` đồng bộ với spec tooltip mới (Fix #1).

**Verify:** `tsc --noEmit` pass. Grep `fill: '#000'` / `color: 'black'` toàn `src/` → 0 hit, không còn chỗ hardcode màu chữ tối ở chart nào khác. Sentiment doughnut cluster 4 dùng CSS conic-gradient (không phải recharts) → không liên quan.

**File touched:** `prototype/src/components/charts/PieChart.tsx`.

### Fix #3 — Pie chart: thêm center label, bỏ tooltip popup chèn vào ring (2026-05-08)

**Triệu chứng:** Sau Fix #2 user phản hồi qua screenshot OLED:
- Donut hole ở giữa trống trơn — "thông tin bên trong đâu rồi?"
- Recharts default Tooltip popup ("GIỮ : 55") bám theo cursor, khi hover gần tâm donut thì đè trực tiếp lên vòng màu → mất thẩm mỹ.

**Quyết định UX:** Bỏ hẳn tooltip popup, thay bằng **center label trong donut hole** — pattern phổ biến cho donut charts. Lợi: thông tin luôn hiển thị ở vị trí cố định (không chạy theo cursor), không bao giờ chèn ring, vừa fill được khoảng trống ở tâm vừa cung cấp context tốt hơn (hiện cả tổng số mã + percentage).

**Fix:** [PieChart.tsx](prototype/src/components/charts/PieChart.tsx)
1. Bỏ import `Tooltip` và xóa `<Tooltip>` element. Center label thay thế chức năng hover-info.
2. Thêm `useState<number | null>` cho `activeIndex`. Wire `<Pie onMouseEnter={(_, idx) => setActiveIndex(idx)} onMouseLeave={() => setActiveIndex(null)}>`.
3. Wrap `<ResponsiveContainer>` trong `<div className="relative">`. Add overlay `<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">` ở center:
   - **Mặc định (no hover):** label "Tổng" (uppercase tracking-wider, secondary color) + tổng số (text-2xl bold, tertiary) + "mã"
   - **Hover slice:** cả 3 dòng (tên slice + count + "X% · trên Y mã") đồng bộ cùng màu của slice (xanh MUA / vàng GIỮ / đỏ BÁN) — set color trên wrapper div, dòng cuối opacity 0.85 để có hierarchy nhẹ
4. `pointer-events-none` trên overlay → không chặn mouse events vào pie bên dưới (quan trọng — nếu có pointer-events thì hover detection sẽ bị mất).
5. `paddingBottom: 24` trên overlay để bù phần Legend dưới đáy, giữ center label thực sự ở giữa vòng donut (không bị legend đẩy lệch).
6. `isAnimationActive={false}` trên Pie để tránh animation lag khi chuyển active state.

**Verify:** `tsc --noEmit` pass. `text-2xs` đã tồn tại trong tailwind config (dùng ở page.tsx, settings/page.tsx).

**File touched:** `prototype/src/components/charts/PieChart.tsx`.

### Fix #4 — Radar tooltip nhảy lung tung theo cursor (2026-05-08)

**Triệu chứng:** Hover vào biểu đồ Radar 5 nhóm features (cả ở Dashboard và Stock Detail), tooltip "tên trục: giá trị" xuất hiện ở vị trí lộn xộn theo cursor, snap nhảy giữa các điểm gần nhất → cảm giác "nhảy lung tung". Plus: tooltip không có chấm tròn ở các vertex (recharts mặc định `dot={false}`), nên user khó biết hover vào đâu để xem.

**Root cause:** Cả `RadarChart.tsx` (cluster 2) và `ScoreBreakdown.tsx` (cluster 3) dùng recharts `<Tooltip>` mặc định. Recharts trong RadarChart dùng "polygon-area hover detection" + tooltip position bám cursor → mỗi mousemove là 1 reposition. Đây là default behavior, không phải bug code.

**Quyết định UX:** Bỏ hẳn recharts `<Tooltip>`, custom hover-dot tự xử lý. Tooltip chỉ hiện khi hover trực tiếp vào dot, position fixed dựa trên tọa độ cực của dot, đứng yên cho đến khi mouse leave.

**Fix — file mới [radar-tooltip.tsx](prototype/src/components/charts/radar-tooltip.tsx):**
1. `radarOutwardVector(index, total)` — tính unit vector `(dx, dy)` từ tâm chart hướng ra dot thứ i. Dùng convention recharts: axis 0 ở 90° (top), clockwise. Đây là helper geometry chính.
2. `createRadarHoverDot({ color, total, onHover, seriesName })` — factory tạo custom dot renderer cho `<Radar dot={...}>`. Mỗi dot render:
   - Visible circle r=4 với `stroke=var(--color-theme-card-bg)` (viền theme-aware để dot không chìm vào polygon fill)
   - Invisible hitbox circle r=14 `pointerEvents="all"` cho dễ hover (radius nhỏ thì hover khó)
   - `onMouseEnter` set hover state với `{x, y, dx, dy, axis, value, color, seriesName}`
   - `onMouseLeave` clear state
3. `<RadarHoverTooltip state offset={30}>` — popup div absolute trong wrapper relative div:
   - Position `left = x + dx*offset, top = y + dy*offset` → đẩy tooltip ra ngoài polygon theo hướng outward
   - `transform: translate(...)` chọn anchor động dựa vào `(dx, dy)`: dx > 0.3 → start, dx < -0.3 → end, else center. Same cho dy. Threshold 0.3 cho near-axis points stay centered (đẹp hơn alignment cứng nhắc).
   - Style giống tooltip treemap (Fix #1): bg `var(--color-theme-tooltip-background)`, border `var(--color-theme-tooltip-border)`, padding 8px 12px, shadow-lg, backdrop-blur 2px.
   - Body: axis name (font-bold) + 1 dòng "[seriesName:] value" với màu = series color.

**Fix — [RadarChart.tsx](prototype/src/components/charts/RadarChart.tsx) (single-series, dashboard):**
- Bỏ import `Tooltip`. Wrap container trong `<div className="relative">`. Add `useState<RadarHoverState | null>`.
- Pass `dot={renderDot}` + `activeDot={false}` cho `<Radar>` (activeDot=false defensive — không cho recharts vẽ thêm dot phụ khi tooltip "active").
- Add `<RadarHoverTooltip state={hover} />` cuối wrapper.

**Fix — [ScoreBreakdown.tsx](prototype/src/components/stock-detail/ScoreBreakdown.tsx) (dual-series, stock detail):**
- Tương tự nhưng có 2 dot renderers: `renderTickerDot` (color = ssi-up, seriesName = "VHM") và `renderIndustryDot` (color = text-secondary, seriesName = "Trung bình ngành").
- Mỗi `<Radar>` series có `dot` riêng → hover ticker dot show ticker value, hover industry dot show industry value (không show cả 2 cùng lúc — đúng spec "Tooltip phải hiển thị: tên trục/feature và giá trị số" singular).
- Wrapper div cho radar đổi sang `className="relative"` để absolute tooltip position đúng.

**Lợi của design:**
- Tooltip position là **pure function** của (cx, cy, index, total) → identical mỗi lần hover cùng dot, không bao giờ "trôi".
- Không có `mousemove` listener nào — chỉ enter/leave per dot.
- Outward direction từ polar coordinate đảm bảo tooltip luôn nằm BÊN NGOÀI polygon (không che chart) bất kể axis ở vị trí nào (top/bottom/left/right).
- Dual-series hover độc lập: ticker dot và industry dot ở cùng axis có thể hover riêng biệt, mỗi cái show tooltip riêng.

**Verify:** `tsc --noEmit` pass clean. Test mental: 5-axis radar, axis 0 ở top (cos90=0, -sin90=-1) → dx=0, dy=-1, tooltip translate(-50%, -100%) → bottom-center của tooltip ở offset point → tooltip nằm phía trên dot ✓. Axis 1 góc 18° (upper-right) → dx≈0.95 dy≈-0.31 → translate(0%, -100%) → bottom-left ở offset → tooltip extend up-right ✓.

**File touched:** `prototype/src/components/charts/radar-tooltip.tsx` (mới), `prototype/src/components/charts/RadarChart.tsx`. Cluster 3 file (`ScoreBreakdown.tsx`) cũng được update — log entry tương ứng ở `cluster-3-summary.md` §12.

**Iteration 2 (cùng ngày, sau user feedback screenshot):**

Sau khi anh test, phát hiện 2 issue:

a) **Tooltip body thiếu axis name + series name** — chỉ hiện mỗi value. Root cause: `payload?.axis` không reliable trong recharts dot props (recharts có thể transform payload hoặc function-form dot không nhận đủ data fields như `<Dot>` element form). Fix: refactor `createRadarHoverDot` API — thay `total: number` bằng `axes: string[]` array. Lookup axis qua `axes[index]` thay vì `payload.axis` → robust, không phụ thuộc vào internal recharts behavior.

b) **Tooltip placement OUTWARD đè vào PolarAngleAxis labels** ("Sentiment", "Technical"...). Root cause: PolarAngleAxis labels nằm OUTSIDE polygon (recharts đặt ở radius ≈ outerRadius + 8-10px). Tooltip với offset=30 outward rơi đúng vùng đó. Fix: chuyển sang **INWARD placement** — `tx = x - dx*offset, ty = y - dy*offset` đẩy tooltip vào tâm polygon thay vì ra ngoài.
   - Polygon interior thường trống (nhất là khi values < 100), tooltip có nền đặc che grid lines clean.
   - Translates đảo ngược: dx > 0.3 → translateX `-100%` (tooltip bên trái dot, edge phải anchor at offset point); dx < -0.3 → `0%`. Same logic cho dy.
   - Offset giảm xuống 24 (từ 30) cho compact hơn vì giờ vào trong, không cần "thoát" axis labels.
   - Kết quả: tooltip nằm giữa dot và tâm chart, không bao giờ chạm axis labels (Sentiment, Macro, ...) hay điều gì ngoài polygon.

c) Conditional render axis name: `{state.axis && <div>...</div>}` — không render empty header div nữa (trước đây nếu axis rỗng vẫn có `mb-0.5` margin tạo space thừa).

**File touched (iteration 2):** `prototype/src/components/charts/radar-tooltip.tsx`, `prototype/src/components/charts/RadarChart.tsx`, `prototype/src/components/stock-detail/ScoreBreakdown.tsx` (đổi API call).

**Iteration 3 (cùng ngày, sau screenshot 2 của user):**

Sau iteration 2, user phát hiện 2 issue mới qua screenshot:

a) **Tooltip inward đè polar radius numbers (0/25/50/75/100)** — `PolarRadiusAxis angle={90}` đặt labels theo trục dọc, đúng đường inward của Fundamental dot và một phần đè vào tooltip của các dot khác. Test geometry: với 5 axis, mọi giá trị angle đều là "đối diện" với 1 axis nào đó, nhưng angle ở **gap giữa 2 axis kề nhau** thì labels nằm ở khu vực mà inward tooltip ít va vào nhất.

b) **"Fundamental" label dính số "100"** — vì cả 2 đều ở top. Khi PolarRadiusAxis ở 90, "100" hiện ngay dưới "Fundamental". Khoảng cách = 5px (recharts default tick offset).

**Fix:** [radar-tooltip.tsx](prototype/src/components/charts/radar-tooltip.tsx) + [RadarChart.tsx](prototype/src/components/charts/RadarChart.tsx) + [ScoreBreakdown.tsx](prototype/src/components/stock-detail/ScoreBreakdown.tsx)

1. **`PolarRadiusAxis angle: 90 → 45`** — di chuyển radius labels (0/25/50/75/100) sang đường chéo upper-right, ở **gap giữa Fund (90°) và Tech (18°)**, nằm ngoài đường inward của tất cả dots. Verify geometry:
   - Fund (top) inward → vertical down: không cross 45° diagonal ✓
   - Tech (upper-right) inward → toward center via 198° direction: tooltip bbox với translateX `-100%`, translateY `0%` nằm trong vùng (`x ∈ [Tech_x-W, Tech_x]`, `y ∈ [Tech_y, Tech_y+H]`) — không chạm radius labels tại 45° ✓
   - Macro/RE inward → tooltip ở các góc đối diện, không cross 45° ✓
   - Sent (upper-left) inward → tooltip x range cao nhất là Sent_x + 23, x của radius "25" tại 45° là 26.5 — marginal nhưng safe ✓

2. **`createOutwardTick(axes, 6)`** — helper mới trong `radar-tooltip.tsx`. Custom tick renderer cho `PolarAngleAxis` push labels thêm 6px ra ngoài theo polar direction:
   - Lookup axis index từ `axes.indexOf(payload.value)` → tính `angle = 90 - i*72°` → `dx = cos(a)*6, dy = -sin(a)*6` → translate `<text>` element.
   - Map `verticalAnchor` (recharts-specific) sang `dominantBaseline` (SVG): start→hanging, middle→central, end→auto.
   - Áp dụng cho cả 2 radar files. Hiệu quả: "Fundamental" được đẩy lên cao thêm 6px, kết hợp với việc "100" đã chuyển sang chéo (45°) → khoảng cách giữa 2 label rất thoáng.

3. **Reduce `outerRadius`: 75% → 72%** — polygon hơi nhỏ lại, có thêm 3% chart radius cho axis labels và tooltip không bị clip sát mép card.

**Verify:** `tsc --noEmit` pass clean. Geometric reasoning đã list trong code comment phần `RadarHoverTooltip` (về INWARD placement) và trong analysis trên (về 45° angle choice).

**File touched (iteration 3):** `prototype/src/components/charts/radar-tooltip.tsx` (thêm `createOutwardTick`), `prototype/src/components/charts/RadarChart.tsx`, `prototype/src/components/stock-detail/ScoreBreakdown.tsx`.
