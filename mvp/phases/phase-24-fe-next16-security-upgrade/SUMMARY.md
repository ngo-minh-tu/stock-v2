# Phase 24 — FE Next 16 Security Upgrade (BLOCKING ngrok hand-off)

**Started:** 2026-05-21 · **Closed:** 2026-05-21
**Roadmap:** Track 1 Security hardening — đóng Phase 21+ §6.2 carry: FE `next` 14.2.15 → 16.2.6 (1 critical) + `next-intl` 3.20.0 → 4.12.0 + `postcss` (via Next) + `eslint`/`eslint-config-next` 8→9 cho peer-deps. Phase 24 là **blocking gate cho ngrok hand-off** vì critical CVE chain trên `next` không thể expose lên Internet.

## 1. Scope

3 stream song hành:

1. **FE dependency upgrade** — `next` 14.2.15 → 16.2.6 (loại critical CVE chain + 2 moderate post-css), `next-intl` 3.20.0 → 4.12.0, `eslint` 8.57.1 → 9.39.4, `eslint-config-next` 14.2.15 → 16.2.6. KHÔNG upgrade React 19 (Next 16 vẫn accept React 18.2+; giữ Recharts + lightweight-charts compatibility).
2. **Next 15+ breaking-change fix** — `src/app/share/[token]/page.tsx`: dynamic route `params` giờ là `Promise<{ token }>`, convert sang `async` component + `await params`.
3. **Next 16 Turbopack-vs-webpack gate** — Next 16 default Turbopack, conflict với webpack alias trong [next.config.js](../../frontend/next.config.js) (MSW SSR shim). Add `--webpack` flag vào `dev` + `build` scripts để pin webpack; Turbopack migration defer Phase 27 UX polish.
4. **Latent portfolio bug bubble-up** — Playwright fail trên test 05 sau upgrade lộ pre-existing schema drift: `stock?.latest_price.close` thiếu inner optional chaining, crash khi `stock.latest_price` undefined (BE returns `latest`, FE accesses `latest_price`). Phase 19 + Phase 20-22 Playwright luôn pass nhờ dev-mode render timing; Next 16 production build timing đổi → bug expose. Fix minimal: add `?.` ở mỗi level. Schema rename FE `latest_price` → `latest` chính thức defer Phase 25.

Out of scope: React 19 upgrade (defer cho cycle riêng — kiểm Recharts/lightweight-charts compat); Turbopack migration (Phase 27); FE schema rename `latest_price` → `latest` (Phase 25).

## 2. Pre-code spec audit (drift report)

| # | Drift | File | Resolution |
|---|---|---|---|
| 24-01 | Next 16 peer deps không require React 19 — vẫn accept `^18.2.0`. React 18.3.1 hiện tại OK. Recharts 2.13 + lightweight-charts 4.2 không cần upgrade. | (research only) | Stay React 18 → tránh breaking 2 chart lib. |
| 24-02 | Next 16 default Turbopack. `next.config.js` có webpack alias `msw/browser: false` cho SSR shim (Phase 9 MSW gating). Turbopack KHÔNG có equivalent alias config. | `next.config.js` + `package.json` | Pin `--webpack` flag vào `dev` + `build`. Defer Turbopack migration. |
| 24-03 | Next 15+ async params breaking: `src/app/share/[token]/page.tsx` dùng `params: { token: string }` sync. | `share/[token]/page.tsx` | Convert sang `async function` + `params: Promise<{token: string}>` + `await params`. |
| 24-04 | next-intl 4 peer deps accept Next 16. NextIntlClientProvider client-side API không breaking cho ICU + `useTranslations` usage hiện tại. KHÔNG có server-side `getRequestConfig` trong codebase. | (no change) | Direct upgrade safe. |
| 24-05 | eslint-config-next 16 peer requires eslint ≥ 9.0.0. eslint 8.57.1 hiện tại → bump 9.39.4. Repo không có custom eslint config (chỉ `extends: ['next/core-web-vitals']`) → eslint 9 flat-config behavior không ảnh hưởng. | `package.json` | Bump eslint 9. `next lint` wrapper compatible. |
| 24-06 | Latent portfolio bug — `stock?.latest_price.close` chỉ optional-chain ở `stock`, không ở `latest_price`. Schema drift: BE serialize `latest` (`StockListItem.latest`), FE type `latest_price`. Runtime: `stock` luôn defined post-load, `stock.latest_price` luôn `undefined` → `.close` throw `Cannot read properties of undefined (reading 'close')` ngay khi VHM row được rendered sau POST 201. | `app/(app)/portfolio/page.tsx` | Add `?.` ở mỗi level: `stock?.latest_price?.close`, ditto ceiling/floor/reference. Pass-through fallback to `buy_price`. Full rename `latest_price` → `latest` defer Phase 25. |
| 24-07 | Vulnerabilities sau upgrade: 1 critical eliminated. 3 moderate remain (postcss XSS via `</style>` stringify, transitive qua next + next-intl). Build-time tool, không exploit từ user input. Acceptable cho ngrok hand-off. | (audit only) | Wait upstream `next` bundled postcss bump. |

## 3. Deliverables

| Tệp | Mục đích |
|---|---|
| `frontend/package.json` | next 16.2.6, next-intl 4.12.0, eslint 9.39.4, eslint-config-next 16.2.6. `dev` + `build` scripts thêm `--webpack` flag. |
| `frontend/package-lock.json` | Lockfile updated cho 64 packages added / 48 removed / 36 changed. |
| `frontend/src/app/share/[token]/page.tsx` | Async params: `params: Promise<{token: string}>` + `await params`. |
| `frontend/src/app/(app)/portfolio/page.tsx` | `stock?.latest_price?.close` (+ ceiling/floor/reference) — guard pre-existing schema drift. |

## 4. Exit criteria

| AC | Status | Bằng chứng |
|---|---|---|
| `next` upgrade tới 16.2.6 (eliminates critical CVE chain) | ✅ | `npm list next` → 16.2.6. `npm audit --omit=dev` → 0 critical. |
| `next-intl` upgrade tới 4.12.0 (eliminates moderate open-redirect + prototype-pollution) | ✅ | `npm list next-intl` → 4.12.0. |
| TypeScript clean | ✅ | `npx tsc --noEmit` → no errors. |
| Next 16 production build pass | ✅ | `npm run build` → 14 routes prerendered, build successful (sau khi add `--webpack` flag). |
| Playwright 8/8 critical-path smoke pass | ✅ | `CI=1 npx playwright test` → 8 passed (44.2s). |
| BE pytest 288/288 vẫn pass (FE upgrade không đụng BE) | ✅ | `uv run pytest -q` → 288/288 passed. |
| npm audit prod deps: 0 critical | ✅ | `npm audit --omit=dev` → 3 moderate (postcss transitive — wait upstream Next bump), 0 critical. |
| Async params async dynamic route works | ✅ | Playwright test 07 (Share link) navigates `/share/{token}` → 200 OK + view renders. |

## 5. Quyết định khoá trong phase này

- **Stay React 18.3.1, không upgrade React 19**: Next 16 vẫn accept `^18.2.0`. Avoid breaking Recharts 2.13 + lightweight-charts 4.2 + 2 chart lib chưa support React 19 native. React 19 upgrade defer cho cycle dedicated.
- **Pin webpack flag thay vì migrate Turbopack**: `next.config.js` MSW alias là webpack-specific. Turbopack KHÔNG có equivalent config syntax tại 16.2.6. Migration cần convert sang `turbopack: {...}` config hoặc bỏ alias (test MSW SSR shim trong production). Defer Phase 27 polish.
- **Schema drift fix minimal, không rename**: Source-of-truth là BE schema `StockListItem.latest`. FE đáng lẽ rename `latest_price` → `latest` toàn codebase. Phase 24 chỉ add `?.` để unblock Playwright. Full rename Phase 25 (UX polish + disclaimer + DB refresh cycle).
- **next-intl 4 client-side compat zero-change**: Repo dùng `NextIntlClientProvider` qua `LocaleProvider` (client context), không có `getRequestConfig` server config. v4 API change zero impact.
- **eslint 9 bump cùng phase**: peer dep block cho eslint-config-next 16. Repo không có custom eslint config → flat-config breaking không ảnh hưởng. `next lint` wrapper vẫn work.

## 6. Issues / drift còn open

- **3 moderate postcss vulns transitive qua `next`** — fix available chỉ qua `npm audit fix --force` (revert next 9.x). Wait upstream Next bundle bump. Build-time tool, không user-input exploit path. Acceptable cho ngrok hand-off.
- **FE schema rename `latest_price` → `latest`** — Phase 25 polish. Hiện optional-chain pass-through to `buy_price` fallback (cosmetic functional, không hiển thị real `latest_price` data trên portfolio table — nhưng portfolio row đã hardcode `buy_price` làm current_price từ Phase 7 anyway).
- **Turbopack migration** — Phase 27 polish. `--webpack` flag stable cho Next 16.x release line.
- **React 19 upgrade** — out of scope. Defer khi Recharts 3 + lightweight-charts 5 ship React 19 support.
- **HoldingFormModal TODAY hard-code** (Phase 19 REVIEW Low) — chưa fix. Carry sang Phase 25 UX polish.
- **`useExportPdf` blob.text() raw fetch** — chưa refactor. Phase 27 polish.

## 7. Test commands (reproducible)

```bash
cd /Users/ngominhtu/Projects/stock-v2/frontend

# Type check
npx tsc --noEmit
# (no output = clean)

# Production build
npm run build
# ✓ Generating static pages (14/14)

# Vulnerability audit prod deps
npm audit --omit=dev
# 3 moderate (postcss transitive — wait upstream); 0 critical

# Playwright critical-path smoke
CI=1 npx playwright test
# 8 passed (44.2s)

# Backend regression sanity check
cd ../mvp/code && uv run pytest -q
# 288/288 passed
```

## 8. Hand-off cho phase tiếp theo

Phase 25 (UX polish + disclaimers + DB refresh + sanity check):
- Schema rename FE `latest_price` → `latest` đồng bộ với BE `StockListItem.latest`.
- HoldingFormModal TODAY runtime date.
- 3 banner disclaimer (News fixture / Macro hardcoded / Backtest heuristic).
- Pre-handoff DB wipe + refresh + verify (Phase 21+22 stale data cleanup).
- `feature_service` range sanity check (Phase 22 REVIEW High carry).

## 9. Post-phase fixes

### 2026-05-22 — Recharts 2.13 `ResponsiveContainer` không render dưới Next 16 webpack

**Triệu chứng:** User mở dashboard tổng quan → KPI cards (17/0/11/6/-5.0%) hiển thị đúng nhưng **toàn bộ 5 biểu đồ trống** (Treemap, Pie, Radar, Line VN-Index, Bar Top 10). Không có console error. Repro: production build Next 16.2.6 + bất kỳ run nào có dashboard.

**Root cause:** Recharts 2.13's `ResponsiveContainer` (`node_modules/recharts/es6/component/ResponsiveContainer.js:79-103`) dùng `useEffect` để gọi `setContainerSize` từ `getBoundingClientRect()` của containerRef. Dưới Next 16 + webpack + React 18 strict mode, effect mount nhưng `setContainerSize` không commit state → `sizes` stuck `{-1, -1}` → `chartContent` useMemo (line 107) return `null` → empty div size 958×320, inner HTML rỗng. Đã ruled out: data shape (BE response match types 100%), CSS vars (KPI cards màu OK), strict mode (tắt vẫn fail), `debounce={50}` (fail), `initialDimension={{ width: 800, height: 320 }}` (fail). Bằng chứng quyết định: bypass ResponsiveContainer + pass `width={900} height={320}` cứng cho Treemap → render đầy đủ 8896 chars SVG.

**Fix:** Tạo wrapper [frontend/src/components/charts/ResponsiveChart.tsx](../../../frontend/src/components/charts/ResponsiveChart.tsx) (33 dòng, ResizeObserver + `cloneElement` inject `width`/`height` numeric). Swap 8 chỗ `<ResponsiveContainer width="100%" height="100%">` → `<ResponsiveChart>`:
- 5 dashboard charts: TreemapChart, PieChart, RadarChart, LineChart, BarChart
- 3 chart khác cùng pattern (sẽ break tương tự): ScoreHistogram (run-history compare), BacktestRoiChart (backtest), ScoreBreakdown (stock-detail radar)

**Verify:** `npx tsc --noEmit` clean; Playwright headless: `recharts-wrapper: 5`, `recharts-surface: 10` (trước fix: 0/0); screenshot dashboard tất cả 5 charts render đúng.

**Bài học (link Phase 19 findings pattern):** Phase 24 REVIEW có note "minimal-touch giữ Recharts 2.x để tránh chain upgrade" + Playwright 8/8 pass, **nhưng smoke không assert chart SVG render**. Tương tự 4 bugs Phase 19 — production bug câm, tsc + pytest không catch. Phase 25+ thêm assertion `expect(page.locator('svg.recharts-surface').count()).toBeGreaterThan(0)` trong critical-path Playwright cho mọi route có chart. Cân nhắc upgrade Recharts 3 (ready React 19) ở phase tương lai để loại workaround này.

### 2026-05-23 — BE/FE schema drift audit + 4 fixes

**Trigger:** User report stock-detail click crash `undefined is not an object (evaluating 'currentIndicators.ma20')`. Audit qua Explore agent phát hiện 5 drift class (xem [project_phase24_plus_roadmap memory]).

**Đã fix (3):**
1. **`/api/stocks/{ticker}/prices` thiếu indicators** ([stock_service.py:182](../../../mvp/code/app/services/stock_service.py#L182)) — added `_sma()` + `_compute_indicators()` (MA20/50/200 trên close + MA20 trên volume). FE type `PriceIndicators` không còn undefined. Spot-check VHM: `ma20[-3..]=[150.98, 151.675, 152.86]`.
2. **`/api/news` field name** ([news_service.py:45](../../../mvp/code/app/services/news_service.py#L45)) — `id: int` → `article_id: str`. Khớp FE type `NewsArticle.article_id: string`.
3. **Top MUA fallback view** ([TopMuaTable.tsx](../../../frontend/src/components/tables/TopMuaTable.tsx)) — khi 0 mã MUA, show top 10 by AI score với banner cảnh báo "Đang hiển thị top 10 theo điểm AI" — user UX request, không phải drift.

**Còn open (2 medium):**
- `/api/runs/{a}/compare/{b}` structural mismatch `score_distribution` shape + `summary_diff.scored` vs `total_scored`
- `/api/runs/{id}/stocks/{ticker}` thiếu `raw_indicators` + `imputed_features` + `risk.has_buy_price` (stock-detail render OK nhờ FE optional-chain, nhưng vẫn vi phạm type contract)

### 2026-05-23 — Real RSS news crawler (Phase 24 đã defer post-MVP, giờ implement)

**Trigger:** User reject "fixture demo 150 bài MOCK" — yêu cầu "data thật để scale ra thị trường" + "bám sát TAD/SRS không lệch".

**Spec coverage (per [SRS f10](../../../docs/srs/f10-news-sentiment.md) + [TAD c04](../../../docs/tad/c04-news-sentiment.md)):**
- Crawl order: RSS first → HTML fallback → skip if blocked (TAD c04 §1) ✅
- 5 nguồn: CafeF/VnExpress/Vietstock/Batdongsan/ThanhNien ✅
- Sentiment keyword-based VN với GUARD-08 citation title+source+date (TAD c04 §1.1 MVP) ✅
- `source_errors[]` graceful degradation (TAD c04 §4 + SRS AC-10-01) ✅
- Unknown ticker → store article, exclude per-ticker sentiment ✅

**Architecture (mới):**
- [app/crawlers/news_sources.py](../../../mvp/code/app/crawlers/news_sources.py) — 5 SourceConfig (RSS URL + HTML fallback selector mỗi nguồn)
- [app/crawlers/news_rss.py](../../../mvp/code/app/crawlers/news_rss.py) — `fetch_rss` (feedparser) + `fetch_html` (selectolax) + `crawl_source` orchestrator
- [app/services/sentiment_rule.py](../../../mvp/code/app/services/sentiment_rule.py) — VN wordlist POS/NEG, score `(pos-neg)/total`, threshold ±0.2, GUARD-08 cite format
- [app/services/news_crawl_service.py](../../../mvp/code/app/services/news_crawl_service.py) — orchestrate 5 sources × ticker extraction × upsert by URL unique constraint + purge legacy fixtures (mock.example)
- `POST /api/news/refresh` endpoint ([api/news.py:71](../../../mvp/code/app/api/news.py#L71)) — user-triggered crawl

**Seed change:** [seed.py:344](../../../mvp/code/app/db/seed.py#L344) `run()` thêm `seed_news_fixture` param — default False ở real run, True ở test (back-compat test_seed_news_distribution). New env var `SEED_NEWS_FIXTURE=1/0` override.

**FE change:** Refresh button + i18n keys `news.refresh.{button,loading,successTitle,successMessage,partialTitle,errorTitle}` (vi+en). Disclaimer update: bỏ "post-MVP" → "Bấm 'Cập nhật' để fetch mới nhất".

**Verify thực:**
- BE `POST /api/news/refresh` → `{inserted: 175, purged_legacy_fixture: 150, source_errors: [], counts_per_source: {CAFEF: 50, VNEXPRESS: 50, VIETSTOCK: 20, BATDONGSAN: 5, THANHNIEN: 50}}`
- FE screenshot: 4 cards thật từ ThanhNien (Tiết kiệm Vikki, Đà Nẵng 350 dự án, Techcombank-Masterise, Đà Nẵng 113 khu đất XHN) — link external icon → URL thật cafef.vn/vnexpress.net/vietstock.vn/batdongsan.com.vn/thanhnien.vn
- Sentiment classify đúng: "Tiêu cực" cho bài có "khó khăn"/"vướng mắc", "Trung tính" cho announcements

**Deps mới:** `feedparser>=6.0.12`, `selectolax>=0.4.9` (pyproject.toml).

**Trade-offs đã chọn (theo SRS):**
- Sentiment MVP rule-based — Phase 2 target PhoBERT (TAD c04 §1.1 chấp nhận)
- Manual refresh (button), KHÔNG APScheduler — defer to phase sau theo g04 cache TTL=6h spec; user kiểm soát timing trong MVP
- `MAX_ITEMS_PER_SOURCE=50` cứng — đủ 250 articles mỗi crawl, không over-engineer pagination

**Bài học:** Phase 24 REVIEW line 19 ghi "Recharts 3 + lightweight-charts 5 stabilized 6 months" làm khẩu hiệu defer. Pattern lặp lại với "post-MVP" cho news crawler — user push back vì cần production data. **Phase mới phải audit "post-MVP" deferrals nào còn defendable, nào đã đến lúc implement.**
