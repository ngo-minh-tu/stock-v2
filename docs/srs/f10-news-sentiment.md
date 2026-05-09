---
name: SRS-10 News & Sentiment
description: Crawl 5 nguồn tin (RSS first → HTML fallback) + phân tích sentiment POSITIVE/NEUTRAL/NEGATIVE với citation bắt buộc; UI 2-col desktop + mobile drawer + infinite scroll + sentiment summary widget. Phase 3.
type: feature
module: SRS-10
prd_fr: FR-11
phase: 3
version: v1.4 LOCKED (cluster 4 reconciliation)
---

# F10 — News & Sentiment

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f02-feature-engineering.md](f02-feature-engineering.md) (S01-S03 sentiment scores), [f08-stock-detail.md](f08-stock-detail.md) (deep-link target)
> Related — global: [g01](g01-global-errors-and-validation.md) (ERR-10-*), [g03](g03-appendix-enums-constants.md) (SentimentLabel, NewsSource enums)
> Related — tech: [TAD c04](../tad/c04-news-sentiment.md), [TAD g02 §7](../tad/g02-api.md) (response shapes)

## Changelog

- **v1.4 (2026-05-09, cluster 4 reconciliation):** ➕ ADDED UC-10-02 Frontend News Page UI (2-col desktop + mobile drawer + 5 filter sections + NewsCard structure + SentimentChip 3 tone + infinite scroll IntersectionObserver + accumulator de-dup + source-error banner + SentimentSummaryWidget conic-gradient + mock_news_failure URL toggle + FIXTURE_NOW_MS anchor + relativeTime i18n). Endpoint shape `GET /api/news` trả `source_errors[]` field (cấu trúc 200 OK envelope thay 503 per-source) + `GET /api/news/sentiment/{ticker}` 30-day rollup count=0 → NEUTRAL/0.0/empty. AC-10-06..14 mới.

## UC-10-01: Backend Crawl & Sentiment Pipeline

### Crawl Order

RSS first → HTML fallback → skip if blocked. Per source.

### Per Article Record

```
{
  article_id: auto,
  source: enum(CAFEF | VNEXPRESS | VIETSTOCK | BATDONGSAN | THANHNIEN),
  title: string,
  url: string,
  published_at: datetime,
  content_snippet: string,             // 2-line clamp dùng cho card
  related_tickers: string[],            // extracted from content
  sentiment_label: enum(POSITIVE | NEUTRAL | NEGATIVE),
  sentiment_score: float (-1.0 to +1.0),
  sentiment_reason: string,             // article title + source + date | "unavailable" cho 5%
  crawled_at: datetime
}
```

### Sentiment Rules (GUARD-08)

| Rule | Detail |
|---|---|
| Output enum | Chỉ POSITIVE / NEUTRAL / NEGATIVE |
| Score range | -1.0 to +1.0, 2 decimal places |
| Reason | MUST cite article title + source name + published date |
| `unavailable` reason | Hợp lệ ở 5% bài viết → UI render italic ở footer card (demo UX fallback) |
| No articles 30 days | sentiment_label = NEUTRAL, score = 0.0, reason = "No articles in 30 days", source_breakdown = empty |
| Source down | Skip source, log warning, return remaining 4 sources + `source_errors[]` array trong response |
| Unknown ticker | Article không map to any whitelist ticker → store but exclude from per-ticker sentiment |

### Acceptance Criteria — Backend

| AC ID | Criteria |
|---|---|
| AC-10-01 | Nếu CafeF lỗi → skip + crawl 4 nguồn còn lại; response 200 OK với `source_errors=["CAFEF"]` (KHÔNG return 503 per-source) |
| AC-10-02 | Mỗi article có source + title + url + date + sentiment_label + sentiment_score + sentiment_reason |
| AC-10-03 | sentiment_score trong range [-1.0, +1.0], 2dp |
| AC-10-04 | sentiment_reason chứa article title (không generic) HOẶC literal `"unavailable"` |
| AC-10-05 | Không tin 30 ngày → sentiment_label = NEUTRAL, score = 0.0, source_breakdown = [] |

---

## UC-10-02: Frontend News Page UI

### Layout

| Viewport | Structure |
|---|---|
| **Desktop ≥768px** | 2-col grid: `aside` filter panel sticky 280px wide trên trái + `<main>` flex 1 list bên phải |
| **Mobile <768px** | List full-width; filter button trong header → click → drawer slide-in từ phải với overlay backdrop + close button |

### Filter Panel (5 sections)

1. **Source** — 5 checkbox (CafeF / VnExpress / Vietstock / Batdongsan / ThanhNien) — multi-select, default all.
2. **Sentiment** — radio group: ALL + 3 enums (POSITIVE / NEUTRAL / NEGATIVE) — single-select, default ALL.
3. **Ticker** — `<input list>` với HTML5 native datalist (suggestions từ whitelist), single ticker filter, optional.
4. **Date range** — radio: 7d / 30d (default) / 90d / All.
5. **Mock failure (dev only)** — dropdown chọn 1 source để mock 503 — pass-through qua URL param `?mock_news_failure={source}` để dev tools test acceptance #11.

Reset button khôi phục về default (all sources / ALL sentiment / no ticker / 30d / no mock failure).

### NewsCard Structure

| Region | Content |
|---|---|
| Border-left | 3px solid theo `SENTIMENT_BORDER_TINT[label]` (xem `prototype/src/components/news/SentimentChip.tsx`) |
| Header | `<SourceLogo>` initials box (5 màu fixed C/V/S/B/T) + source name + relative time + open-link icon → click → window.open new tab |
| Title | `<a target="_blank">` link new tab, font-medium, 2-line clamp |
| Snippet | `content_snippet`, opacity 0.7, 2-line clamp |
| Footer | `<SentimentChip>` (POS/NEU/NEG với arrow icon Lucide) + ticker chips → click → `/stock-detail?ticker=X`. Khi `sentiment_reason === "unavailable"` → render italic text "Lý do không khả dụng" |

### Infinite Scroll

`<NewsList>` dùng IntersectionObserver:

| Aspect | Spec |
|---|---|
| rootMargin | `200px 0px 200px 0px` (pre-fetch khi gần bottom 200px) |
| Accumulator | Maintain `accumulator + pageCount + lastResponse` state. De-dup by `article_id` (bảo vệ khỏi re-fetch fast scroll). |
| resetKey | Hash filter shape thành string; khi resetKey đổi → useEffect bump resetCounter → NewsList reset accumulator state (KHÔNG re-mount component, giữ Intersection observer ref). |
| Skip during fetch | Observer skip khi `loading=true` để tránh data loss khi path đổi (offset N → N+20) trong khi fetch in-flight. |
| Reached end | Render "Đã hết tin" footer khi `accumulator.length >= total`. |

### Source Error Banner

`<NewsList>` render banner đỏ (background var(--toast-warning) hoặc `var(--ssi-down)` tint) ở top khi `response.source_errors.length > 0`. Message: "Nguồn {source_name} tạm thời không khả dụng. Đã hiển thị tin từ các nguồn còn lại." Banner persistent, KHÔNG dismissible (để user biết coverage thiếu).

### Sentiment Summary Widget

Render khi user filter ticker (khác null). Component `<SentimentSummaryWidget>`:

| Element | Spec |
|---|---|
| Doughnut | CSS `conic-gradient` 3-segment (KHÔNG Recharts pie — overhead lớn cho chart 3 slice). Inset white circle cho hiệu ứng doughnut. |
| Legend | 3 row (POS/NEU/NEG) với count + color dot. |
| Score average | `summary.score_avg` 2dp signed. |
| Source breakdown | Bar chart bên dưới (5 source × count). |
| count=0 | GUARD-08 fallback: render "Không có tin trong 30 ngày — sentiment NEUTRAL/0.0" (italic note). |

### relativeTime via i18n

`<NewsCard>` compute `relativeTime` qua `useTranslations('news.time')` với keys `minutesAgo`, `hoursAgo`, `daysAgo`, `weeksAgo`. Anchor "now" = `FIXTURE_NOW_MS` (xem [TAD c04 §5](../tad/c04-news-sentiment.md)) — KHÔNG dùng `Date.now()` để tránh drift khi user chạy app ở wall-clock khác fixture date.

### Endpoint Shapes

| Endpoint | Response |
|---|---|
| `GET /api/news?limit=20&offset=0&source=CAFEF&sentiment=POSITIVE&ticker=KDH&from=ISO&to=ISO&mock_news_failure=cafef` | `{ items: NewsArticle[], total, limit, offset, source_errors: NewsSource[] }` |
| `GET /api/news/sentiment/{ticker}?days=30` | `{ ticker, score_avg, label_counts: {POSITIVE,NEUTRAL,NEGATIVE}, source_breakdown: {[source]:count}, total }` — count=0 → NEUTRAL/0.0/empty |

### Acceptance Criteria — Frontend

| AC ID | Criteria |
|---|---|
| AC-10-06 | Desktop ≥768px: 2-col layout với filter aside sticky 280px + main list flex |
| AC-10-07 | Mobile <768px: filter button mở drawer slide-in từ phải; list full-width; close button khôi phục layout |
| AC-10-08 | Infinite scroll qua IntersectionObserver rootMargin 200px; accumulator de-dup by article_id; observer skip khi `loading=true` |
| AC-10-09 | Source error banner hiển thị khi `response.source_errors.length > 0`; cards filtered ra; banner persistent (không dismissible) |
| AC-10-10 | Filter changes (5 sections) → resetKey hash đổi → accumulator reset, pageCount reset, fire fetch mới với offset=0 |
| AC-10-11 | Mock failure dropdown → pass-through `?mock_news_failure={source}` URL param; dev tools test được |
| AC-10-12 | Ticker filter active → SentimentSummaryWidget render top right; count=0 → GUARD-08 fallback "Không có tin trong 30 ngày" (italic) |
| AC-10-13 | Doughnut sentiment summary qua CSS conic-gradient (KHÔNG Recharts) — re-render khi theme đổi tự động qua CSS var |
| AC-10-14 | relativeTime qua i18n keys `news.time.{minutesAgo|hoursAgo|daysAgo|weeksAgo}`; anchor `FIXTURE_NOW_MS` (mock) hoặc `datetime.now(UTC)` (backend) — KHÔNG hard-code chuỗi vi/en |
