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
