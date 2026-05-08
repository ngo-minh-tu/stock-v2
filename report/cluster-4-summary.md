# Cluster 4 Summary — Market Browse (Price Board + News & Sentiment)

## 1. Metadata

- **Cluster:** 4 — Market Browse
- **Khoảng ngày:** 2026-05-07 (1 phiên build, sau cluster 3)
- **Commit kết thúc:** sẽ commit cluster 4 độc lập sau round-2 audit + fix.
- **Prompt:** [prompts/cluster-4-market-browse.md](../prompts/cluster-4-market-browse.md)
- **Cluster trước:** `580c3b6` `feat(prototype): cluster 3 — stock detail deep-dive`.
- **Verify cụm trước:** `npm run lint` + `npm run build` đều pass trước khi cluster 4 bắt đầu. 14 routes, `/news` và `/price-board` đang là `ComingSoon` placeholder.

## 2. Phạm vi

**Dự kiến (theo prompt):**
- Trang `/price-board` (TanStack Table 13 cột với màu TTCK VN, sort/filter, search, click → Stock Detail)
- Trang `/news` (2-col layout: filter panel + list, 5 nguồn, sentiment chip, ticker filter, mock source-error banner, infinite scroll)
- 3 MSW handlers: `GET /api/stocks` (paginated), `GET /api/news` (paginated + filters), `GET /api/news/sentiment/{ticker}`
- 2 fixtures: 81-stock latest-price snapshot, 150-article corpus
- 9 components mới (price-board × 3, news × 5, common × 1) + 3 hooks
- ~50 i18n keys mới (vi/en)
- Mock failure mode `?mock_news_failure=cafef`
- Sentiment summary widget khi ticker filter

**Thực tế làm:** đầy đủ scope.

**Mở rộng ngoài prompt (cố ý):**
- **Anchor TTCK 5-color rule trong fixture**: ngoài `priceColor` chuẩn, fixture chủ động set `seed%12 → ceiling`, `seed%13 → floor`, `seed%17 → ref` — đảm bảo khi user reload luôn thấy mã đại diện cho cả 5 trường hợp (không phụ thuộc vào random luck). Cần cho AC #2.
- **`source_errors` field trong NewsListResponse**: ngoài việc filter ra source bị lỗi, response trả về danh sách `NewsSourceKey[]` để UI render banner — nếu chỉ filter mà không trả flag, banner sẽ không xuất hiện được.
- **Anchor `current_price` từ run mới nhất**: Price Board ưu tiên `current_price` lấy từ run mới nhất (nếu có) trước khi rơi xuống fallback từ seed. Đảm bảo trang Stock Detail (header) và Price Board (close column) cùng số tiền cho cùng 1 mã — nhất quán cross-page.
- **Newly-listed deterministic indexes** (6 mã): `NEWLY_LISTED_INDEXES = {5,17,31,46,58,73}` thay vì random — AC-04 (filter "Mới niêm yết") cần ≥1 mã pass filter chắc chắn.
- **`unavailable` sentiment_reason cho 5%**: ngoài cite source GUARD-08, 5% bài viết được đặt reason = `"unavailable"` để demo UX của fallback (italic chữ ở footer card).

**Cắt khỏi prompt:**
- Pagination implementation: prompt §3.4 nói "default đủ 1 page (no pagination needed)" + "vẫn implement infinite scroll skeleton để test UX nếu mở rộng sau". Cụm 4 chỉ implement `limit=100` + load all → 1 fetch; KHÔNG mock infinite scroll cho Price Board (chưa cần). Chỉ infinite scroll cho News.

## 3. File mới

### Mock data layer (2 file)
- [src/mocks/data/news-fixture.ts](../prototype/src/mocks/data/news-fixture.ts) — corpus 150 articles, deterministic mulberry32(`'NEWS'` = 0x4e455753). 18 title templates (5 positive / 6 neutral / 7 negative), 9 snippet templates. Distribution 40/35/25 (verified ±0.5%). Anchor "today" = 2026-05-07. 5% rate `sentiment_reason = "unavailable"` (GUARD-08 fallback). Sort newest-first. `filterArticles({source,sentiment,ticker,fromIso,toIso})` exported.
- [src/mocks/data/price-board-fixture.ts](../prototype/src/mocks/data/price-board-fixture.ts) — `buildPriceBoardItems()` snapshot 81 mã. HOSE 7% / HNX 10% / UPCOM 15% band. `seed%12/13/17` anchors → ceiling/floor/ref forced. Volume 100K-2M + 5% spike to 5M. `current_price` ưu tiên lấy từ `runsStore.latest()` để đồng bộ với Stock Detail header.

### Hooks (1 file)
- [src/lib/hooks/useStocks.ts](../prototype/src/lib/hooks/useStocks.ts) — 3 wrapper trên `useApiResource`: `useStocks(limit, offset)`, `useNews(NewsFilterParams)`, `useSentimentSummary(ticker, days)`. `buildNewsPath` exported nếu cụm sau cần prefetch. Date range → ISO conversion local trong hook.

### Components — price-board/ (3 file)
- [src/components/price-board/PriceCell.tsx](../prototype/src/components/price-board/PriceCell.tsx) — single-purpose cell với 2 mode: `static` (force token) cho cột Reference/Ceiling/Floor/Open, `dynamic` (apply `priceColor` rule) cho High/Low/Close/Change/Change%. `anchor` prop cho phép tính color theo close mà display change number → change/change% có cùng màu close.
- [src/components/price-board/PriceBoardFilters.tsx](../prototype/src/components/price-board/PriceBoardFilters.tsx) — 3 filter group: Exchange chips (multi-select), Sector dropdown, Newly-listed toggle. Reset button. Exchange chips dùng cùng tone TTCK với ExchangeBadge (HOSE up / HNX floor / UPCOM ref).
- [src/components/price-board/PriceBoardTable.tsx](../prototype/src/components/price-board/PriceBoardTable.tsx) — TanStack Table 14 cột (1 sticky header, font Roboto 11px, alternating row bg). Default sort `[close DESC]` (AC #1). Search debounce 200ms qua `useEffect`. `data-color-tag={closeColor}` mỗi row cho a11y/QA test. Click ticker → `router.push('/stock-detail?ticker=...')`.

### Components — news/ (5 file)
- [src/components/news/SentimentChip.tsx](../prototype/src/components/news/SentimentChip.tsx) — 3 chip POSITIVE/NEUTRAL/NEGATIVE với arrow icon (Lucide). Tooltip = `Score: +0.65 (POSITIVE)` (cluster prompt §4.3). Export `SENTIMENT_BORDER_TINT` cho NewsCard border-left.
- [src/components/news/NewsCard.tsx](../prototype/src/components/news/NewsCard.tsx) — Header (logo + source name + relative time + open-link icon), title (link new tab), snippet (2-line clamp), footer (sentiment chip + ticker chips → click → Stock Detail). Border-left 3px theo sentiment color. `unavailable` reason render italic ở footer.
- [src/components/news/NewsFilters.tsx](../prototype/src/components/news/NewsFilters.tsx) — 5 section: Source checkboxes (multi), Sentiment radio (ALL + 3 enums), Ticker datalist input, Date-range radio, Mock-failure dropdown. Reset all.
- [src/components/news/NewsList.tsx](../prototype/src/components/news/NewsList.tsx) — Infinite scroll qua IntersectionObserver (rootMargin 200px), de-dup by `article_id`, accumulator pattern. Source-error banner top + skeleton-5 loading + reached-end footer. `resetKey` prop (string hash của filters) → reset accumulator + pageCount.
- [src/components/news/SentimentSummaryWidget.tsx](../prototype/src/components/news/SentimentSummaryWidget.tsx) — Doughnut bằng CSS conic-gradient (KHÔNG library). 3-segment legend + count. Source breakdown bar bên dưới. count=0 → render GUARD-08 fallback note.

### Components — common/ (1 file)
- [src/components/common/SourceLogo.tsx](../prototype/src/components/common/SourceLogo.tsx) — Initials trong rounded box (C/V/S/B/T) với 5 màu fixed. Export `SOURCE_BORDER_TINT` cho cụm sau nếu cần.

## 4. File sửa

- [src/lib/constants.ts](../prototype/src/lib/constants.ts) — thêm `EXCHANGES`, `NEWS_SOURCES`, `SENTIMENT_LABELS`, `NEWS_DATE_RANGES`, `priceColor()` + `TtckColor` type. Why: TTCK color rule cần là source-of-truth (cluster prompt §3.3) — không inline trong PriceCell vì test sẽ khó.
- [src/lib/types.ts](../prototype/src/lib/types.ts) — thêm `LatestPrice`, `StockListItem`, `StocksListResponse`, `NewsSource`, `SentimentLabel`, `NewsArticle`, `NewsListResponse`, `SentimentSummaryResponse`. Why: lock shape cho 3 endpoint mới của cụm 4 + giữ convention "ngàn đồng" trong `current_price`.
- [src/mocks/handlers.ts](../prototype/src/mocks/handlers.ts) — 3 handler mới + 5 import. Why: cluster prompt §6.
  - `GET /api/stocks` — pagination chuẩn g02 §2 (limit/offset, default 100).
  - `GET /api/news` — multi-source/multi-sentiment OR-logic, ticker/date filter, `mock_news_failure` URL toggle.
  - `GET /api/news/sentiment/:ticker` — 30-day rollup; count=0 → NEUTRAL/0.0 (GUARD-08).
- [src/messages/{vi,en}.json](../prototype/src/messages/) — namespace `priceBoard.*` (~25 keys/file) + `news.*` (~50 keys/file). Why: convention bilingual mọi key.
- [src/app/(app)/price-board/page.tsx](../prototype/src/app/(app)/price-board/page.tsx) — replace ComingSoon bằng full wiring: useStocks(100) + filter state + filteredRows useMemo + PriceBoardTable.
- [src/app/(app)/news/page.tsx](../prototype/src/app/(app)/news/page.tsx) — 2-col desktop layout (sticky 280px filter + flex list), mobile drawer (`md:hidden` toggle), ticker → SentimentSummaryWidget render, source-error state.

## 5. Refactor / nâng cấp

- **Không refactor cluster 1-3.** Cụm 4 là 2 trang mới, không touch dashboard/top-mua/red-flags/stock-detail.
- **Reuse**: `useApiResource` (cluster 1), `ExchangeBadge` (cluster 3), `STOCK_FIXTURE` + `runsStore` (cluster 1-2), pattern `next-intl + Tailwind utility classes`.
- **TanStack Table** đã có từ cluster 2 — không cần dep mới (cluster prompt §2 confirm).

## 6. Quyết định kỹ thuật

- **TTCK color rule là pure function trong `lib/constants.ts`**: `priceColor(price, ceiling, floor, reference)` — testable, importable, áp dụng 1 nguồn duy nhất cho PriceCell, PriceBoardTable's row tag, và (cụm sau) Stock Detail header. Quan trọng cho AC #2.
- **Order ceiling/floor BEFORE up/down**: nếu user set `close >= ceiling` (nhưng có thể ceiling==reference khi data lỗi) → ceil thắng up. Cluster prompt code snippet dùng `===` strict; tôi đổi thành `>=`/`<=` để robust với rounding 2dp. Float compare trên 2dp đôi khi 32.50 ≠ 32.500001 → dùng `>=` để clamp.
- **`PriceCell` 2 mode (static/dynamic)**: tránh ép mỗi cell pass cả 4 number `ceiling/floor/reference/value` cho cột Reference (chỉ cần fixedColor='ref'). Type discriminated union → TS autocomplete.
- **`anchor` prop cho dynamic mode**: change/changePct numeric value khác close, nhưng color phải khớp close. `anchor` prop tách "what to display" khỏi "what to color against". Pattern này dùng được cho cụm 5 nếu cần show portfolio P/L với màu theo current price.
- **Default sort = Close DESC**: AC #1 yêu cầu. TanStack Table accept `[{id:'close', desc:true}]` initial state; sortable header click vẫn hoạt động bình thường để toggle.
- **Search debounce 200ms qua useEffect+setTimeout**: KHÔNG dùng `debounce` từ lodash. Cluster prompt §3.4 nói cụ thể 200ms. Single useEffect đủ.
- **News pagination = accumulator + IntersectionObserver**: thay vì `usePaginatedQuery` library, tự maintain `accumulator + pageCount + lastResponse`. De-dup by `article_id` để bảo vệ khỏi re-fetch khi user fast-scroll. `rootMargin: '200px 0px 200px 0px'` để pre-fetch khi gần bottom 200px (cluster prompt §4.5).
- **`resetKey` cho NewsList**: khi filter thay đổi, accumulator phải reset → tránh re-mount component (mất Intersection observer ref). Pattern: hash filter shape thành string, `useEffect([resetKey]) → setResetCounter+1`, NewsList nhận resetCounter và reset state.
- **`source_errors` trả về trong response**: thay vì throw 503 cho 1 source riêng — single envelope 200 OK với error array. Lý do: client cần hiển thị data từ 4 source còn lại + banner cho source lỗi đồng thời. Đúng spec GUARD-08 / SRS f10 AC-10-01.
- **Sentiment summary doughnut = CSS conic-gradient, không Recharts**: chart đơn giản (3 slice), Recharts pie sẽ overhead lớn. Conic gradient + inset white circle cho hiệu ứng doughnut. Re-render khi theme đổi tự động qua CSS var.
- **Mock-failure URL toggle exposed trong UI**: thay vì chỉ qua URL param manual, NewsFilters có dropdown "Mô phỏng lỗi nguồn (dev)" → user/QA test acceptance #11 dễ dàng. Vẫn pass-through qua URL param `mock_news_failure` để dev tools test được.
- **`current_price` anchor từ run mới nhất**: Price Board phụ thuộc vào runsStore. Nếu chưa có run nào → fallback `12 + (seed % 80)`. Side-effect: trước khi user run lần đầu, Close cột vẫn render đẹp. Sau khi run, các mã được scored sẽ có giá khớp với Stock Detail header.
- **Datalist cho ticker filter**: HTML5 native `<input list>` thay vì combobox library — UX đủ tốt cho prototype, không thêm dep.
- **Source logo = initials, không asset thật**: cluster prompt §10 chỉ định rõ.

## 7. Dependencies

**Thêm mới (deps):** không.

**Bỏ / upgrade:** không.

**Vulnerabilities:** không phát sinh thêm. Tree từ cluster 3 vẫn 6 vulns chưa fix (audit sang cụm 6).

## 8. Mock data

- **Price Board** ([price-board-fixture.ts](../prototype/src/mocks/data/price-board-fixture.ts)): 81 mã với latest_price coherent. Anchor close ưu tiên `runsStore.latest()`. Newly-listed: 6 mã ở index {5, 17, 31, 46, 58, 73}.
- **News corpus** ([news-fixture.ts](../prototype/src/mocks/data/news-fixture.ts)): 150 articles, mulberry32 deterministic. 18 title templates × 9 snippet templates × 5 sources (even). Distribution POSITIVE 40% / NEUTRAL 35% / NEGATIVE 25%. 5% reason = `"unavailable"`.
- **Sentiment summary** (handler inline): 30-day window từ `Date.now()` (chú ý: không phải ISO của fixture's "today", dùng wall clock thực). count=0 → NEUTRAL/0.0/empty breakdown (GUARD-08).
- **TTCK anchor cases** (price-board-fixture): seed%12 → ceiling, seed%13 → floor, seed%17 → ref. Ít nhất 6-7 mã trong 81 sẽ trigger mỗi anchor → AC #2 luôn cover 5 cases.

## 9. Nợ kỹ thuật / TODO

- **Bug đã sửa post-build (round 2 audit)** — user trigger "tìm, sửa lỗi" sau khi tôi đã claim build clean:
  1. **News pagination data loss**: `IntersectionObserver` trong NewsList có thể fire trong khi 1 page đang fetch → path đổi (offset N → N+20) → `useApiResource` cancel fetch → page in-flight bị mất. Trên fast scroll, accumulator nhảy missing 20 articles. Fix: skip observer khi `loading=true`, deps `[accumulator.length, lastResponse, loading]`.
  2. **Sentiment summary + date-range filter dùng `Date.now()`**: news fixture neo về 2026-05-07 (memory `currentDate`), nhưng handler `/api/news/sentiment/{ticker}` và `isoFromDateRange` dùng wall-clock thực. Nếu user chạy app ở ngày khác, sentiment summary luôn count=0 (giả vờ GUARD-08 fallback nhưng thực ra là bug). Fix: export `FIXTURE_NOW_MS` từ `news-fixture.ts` (`2026-05-07T08:00:00Z`), dùng anchor đó ở handler + hook + NewsCard `relativeTime`.
  3. **Mobile drawer chèn nhầm `<p>{t('loading')}</p>`** ở cuối filter panel — copy-paste residue. Removed.
  4. **NewsPage `sourceErrors` dead state**: declared `useState<NewsSourceKey[]>([])` + render trong `<span className="sr-only">` nhưng banner thực tế nằm trong NewsList. Removed cả prop `onSourceErrorsChange` (giảm coupling).
  5. **`relativeTime` trong NewsCard hard-code chuỗi vi/en**: đã add `news.time.*` keys vào messages nhưng quên dùng. Fix: pass `useTranslations('news.time')` vào helper, dùng `t('minutesAgo', {n})` etc.
- **Stock Detail không có "static-only" mode**: cluster prompt §3.4 nói "Click row → /stock-detail?ticker=X (không cần run_id — show static info)". Hiện tại Stock Detail page (cluster 3) yêu cầu `run_id` (fallback `lastCompletedRunId`). User chưa run lần nào → click Price Board ticker → hiện error block "Không tải được chi tiết mã". Fix: page cần render static `/api/stocks/{ticker}` payload khi không có run available. Cụm 5 hoặc bug-fix patch.
- **`current_price` đơn vị "ngàn đồng" vẫn chưa thống nhất** (đã ghi nhận từ cluster 2/3): cluster 4 reuse convention; chưa thêm helper. Volume hiển thị raw (số cổ phiếu, format K/M); Price hiển thị 2 decimals (32.50 = 32,500 VND). Cụm 5 (Portfolio Lite) buộc phải fix khi join với holdings.
- **Theme switch trên price board chưa user-verify thực tế**: tôi chỉ chạy `npm run lint` + `npm run build` + `curl /price-board → 200`. Theme tokens (`--ssi-up`, `--color-theme-table-row-even`, etc.) inline qua `style={{...}}` → CSS var tự đổi khi `<html data-theme>` đổi. Nhưng chưa test trực tiếp browser. Cụm prompt AC #13 yêu cầu render <200ms khi theme switch — chưa benchmark.
- **News page mobile drawer chưa fully tested**: drawer + overlay + close button code đúng nhưng chưa test trên thực tế viewport mobile/Chrome devtools.
- **Sentiment summary `Date.now()` vs fixture's "today"**: fixture neo articles vào 2026-05-07 (memory `currentDate`), nhưng `useSentimentSummary` handler dùng wall-clock `Date.now()` cho 30-day window. Trên máy user (đang chạy thực tế) wall-clock sẽ là 2025/2026 hiện tại → có thể không match window. Acceptable cho prototype (article timestamps neo cố định, window neo cố định 30 ngày trước now). Nếu cần coherent strict: handler dùng `2026-05-07` làm anchor.
- **`mock_news_failure` chỉ test 1 source tại 1 thời điểm**: prompt §6.5 nói `?mock_news_failure=cafef`. Nếu cần test multi-failure ("CafeF + VnExpress cùng lỗi") → pass nhiều giá trị qua URL hoặc thay logic split-comma. Chưa cần.
- **Volume format chưa parse "tỷ đồng giao dịch"**: chỉ format số cổ phiếu (K/M). Bảng giá thực tế của VN có cột "Giá trị GD (tỷ)". Có thể thêm cột sau.
- **Search debounce có 1ms drift edge case**: khi user nhập nhanh xong rồi đợi 200ms, `debounced` mới update. Acceptable nhưng nếu user clear input rồi gõ lại, có thể có 1 frame loading. Không cần fix.
- **`stocks-fixture.ts` chưa có `newly_listed` field native**: cluster 4 thêm flag tại `buildPriceBoardItems()` qua `NEWLY_LISTED_INDEXES`. Cụm 5+ nếu cần stable ở schema → add field vào fixture trực tiếp.

## 10. Ảnh hưởng cluster sau

- **Cluster 5 (Personal & History) — phụ thuộc trực tiếp:**
  - Portfolio Lite có thể reuse `useStocks` để lookup `current_price` cho từng holding.
  - `LatestPrice` shape có thể dùng cho Portfolio P/L calculation.
  - Run History compare có thể dùng `useNews({ticker})` để show news context cho mỗi ticker thay đổi recommendation giữa 2 run.
- **Cluster 6 (Export & Integrations):**
  - PDF export có thể bao gồm Sentiment summary doughnut (canvas screenshot từ conic-gradient cần fallback - dùng Recharts pie thay).
  - Telegram Top N message có thể append "Sentiment 30d: avg +0.42 / 12 articles" cho mỗi ticker MUA — endpoint sẵn sàng.
- **Quy ước ổn định không nên đổi:**
  - URL `/stock-detail?ticker=X` (cluster 4 navigate dạng này).
  - `priceColor(price, ceiling, floor, reference)` API + 5-color enum `TtckColor`.
  - `NewsListResponse.source_errors[]` field tồn tại ngay cả khi rỗng (UI luôn check `.length > 0`).
  - Sentiment count=0 → label=NEUTRAL/score=0 (GUARD-08; đừng đổi).

## 11. Test thủ công

| Bước | URL / Action | Kỳ vọng |
|---|---|---|
| 1 | `NEXT_PUBLIC_ENABLE_MSW=1 npm run dev` → login → Dashboard → Run xong (tránh "no run" edge case) | Build success; Dashboard render; lastCompletedRunId set |
| 2 | Sidebar → Bảng giá | Hiển thị header "Bảng giá", subtitle "81 mã", filter row, table 14 cột, 81 rows; default sort theo Close DESC |
| 3 | Search "VHM" | Sau ~200ms, table còn 1 row VHM; clear → 81 rows trở lại |
| 4 | Filter exchange chỉ HOSE (click HNX/UPCOM để bỏ chọn) | Còn ~26+ mã (chỉ HOSE) — 21 real + ~half mock + ~16 sequential mock |
| 5 | Filter "Chỉ mã mới niêm yết" | Còn 6 mã được tag "Mới" |
| 6 | Click ticker VHM trong row | Navigate `/stock-detail?ticker=VHM`; nếu user chưa run → render error (TODO §9) |
| 7 | Đổi theme dropdown (4 trạng thái) khi đang ở Price Board | Background table đổi; ssi-up/down/ref/ceil/floor đổi tone (xanh-vàng-tím-đỏ-xanh dương); render <200ms (chưa benchmark, AC #13) |
| 8 | Test 5 màu TTCK: kiểm tra `data-color-tag` attribute trên row | Trong DevTools, ít nhất 1 row mỗi loại {ceil, up, ref, down, floor} (anchor seed%12/13/17 + random) |
| 9 | Sidebar → Tin tức | Header "Tin tức"; desktop 2-col (filter 280px + list flex); 5 source checkbox check; sentiment radio ALL; date 30 ngày; 20 cards đầu render |
| 10 | Filter Source: chỉ chọn CafeF | List còn ~30 cards (1/5 của 150) — đếm ~ 28-32 |
| 11 | Filter Sentiment radio = POSITIVE | List chỉ chip xanh lá; ~60 cards (40% của 150) |
| 12 | Filter Ticker = "KDH" | Sentiment summary widget xuất hiện top right; doughnut + score TB + count + source breakdown bar; list chỉ articles có "KDH" trong related_tickers |
| 13 | Filter Date range = 7d | Card list giảm rõ rệt (recency-bias 1.4 nên 7 ngày chỉ ~7-10 cards) |
| 14 | Mock failure dropdown = CafeF | Banner đỏ "Nguồn CafeF tạm thời không khả dụng. Đã hiển thị tin từ các nguồn còn lại." xuất hiện; CafeF cards bị filter ra |
| 15 | Scroll xuống cuối list news | Auto-load page tiếp theo (offset 20 → 40 → ...); cards append; cuối cùng render "Đã hết tin" |
| 16 | Click ticker chip trong NewsCard | Navigate `/stock-detail?ticker=X` |
| 17 | Mobile (Chrome devtools 375px) → Tin tức | Filter button ở header; click → drawer slide-in từ phải; news cards stack 1-col |
| 18 | Reset filter button (cả price board + news) | Filter trở về default (all exchanges, sentiments, sources, ticker null, 30d, no mock failure) |
| 19 | DevTools Network khi filter News | Mỗi filter change fire 1 `GET /api/news?source=...&sentiment=...&ticker=...&from=...` mới |
| 20 | Direct nav `/api/news/sentiment/MOCK_INSUFFICIENT` qua DevTools | 200 với count=0, label=NEUTRAL, score=0.0 (GUARD-08) |
| 21 | `npm run build` + `npm run lint` | Pass strict TypeScript + ESLint clean (✓ verified) |
| 22 | Theme switch trên News page khi đang scroll | Sentiment chip color, source-error banner border, conic-gradient doughnut tất cả đổi tone (CSS var) |
| 23 | Bundle size check trong build output | `/news`: 8.26kB, `/price-board`: 5.22kB; tổng First Load JS hợp lý (<130kB) |

## 12. Post-cluster fixes (user feedback)

- **2026-05-08 — UPCOM badge yellow quá chói trên OLED/classic-dark.** User report: badge UPCOM trong Price Board (và filter chip cùng tone) dùng `var(--ssi-ref)` = `#fdff12`, sáng đến mức không nhìn được chữ trong OLED và classic-dark. Không thể sửa trực tiếp `--ssi-ref` vì biến này là TTCK reference yellow, dùng khắp Price Board (5-color rule), GIU recommendation badge, run-history bars — và PRD §8.2 AC-17-03 yêu cầu ổn định cross-theme. Fix: tách biến mới `--exchange-upcom` chỉ cho exchange tag.
  - [src/styles/themes.css](../prototype/src/styles/themes.css) — thêm `--exchange-upcom` ở 4 theme: `classic-dark` & `oled` = `#c9a227` (gold/amber trầm); `classic-light` & `light` = `#e78b03` (giữ tone cũ vì light theme không bị chói).
  - [src/components/badges/ExchangeBadge.tsx:12](../prototype/src/components/badges/ExchangeBadge.tsx#L12) — UPCOM map sang `--exchange-upcom`.
  - [src/components/price-board/PriceBoardFilters.tsx:24](../prototype/src/components/price-board/PriceBoardFilters.tsx#L24) — UPCOM filter button dùng `--exchange-upcom`.
  - User confirm OK cùng ngày qua localhost:3000.
