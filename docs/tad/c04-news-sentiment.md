---
id: c04
title: News & Sentiment Pipeline
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§14); cluster 4 reconciliation 2026-05-09
version: v1.4 LOCKED (cluster 4 reconciliation)
---

# c04 — News & Sentiment Pipeline

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f10-news-sentiment.md](../srs/f10-news-sentiment.md)
>
> Related — global: [g02-api.md](g02-api.md) §7 (response shapes), [g03-database.md](g03-database.md) (writes `news_articles`), [g04-cache.md](g04-cache.md) (5 NEWS_* sources, TTL=6h), [g05-cross-cutting.md](g05-cross-cutting.md) (logging on per-source crawl errors)

## Changelog

- **v1.4 (2026-05-09, cluster 4 reconciliation):** ❌ REMOVED 1-line stub "single payload for all 6 charts + KPIs"-style summary → ✅ REPLACED bằng full architecture: §1 Backend Pipeline (giữ MVP keyword classifier), §2 Frontend Hooks (`useNews` + `useSentimentSummary`), §3 NewsList Pattern (accumulator + IntersectionObserver + de-dup + resetKey), §4 source_errors Envelope (200 OK + array, KHÔNG 503 per-source), §5 FIXTURE_NOW_MS Anchor (mock-only; backend dùng `datetime.now(UTC)`), §6 SentimentSummaryWidget (CSS conic-gradient, KHÔNG Recharts pie).

---

## 1. Backend Pipeline

```
Crawl: RSS first → HTML fallback → skip if blocked
Per article: title, url, source, published_at, content_snippet, related_tickers, sentiment_label, sentiment_score, sentiment_reason
Sentiment: POSITIVE/NEUTRAL/NEGATIVE, score -1 to +1 (GUARD-08)
```

### 1.1 Sentiment classifier evolution

- **MVP:** keyword-based classifier (lookup từ wordlist VN positive/negative).
- **Phase 2 target:** NLP model (PhoBERT fine-tune trên domain news financial VN).

### 1.2 Per-source error handling

Source down (CafeF/VnExpress/Vietstock/Batdongsan/ThanhNien) → skip source, log warning, return remaining + `source_errors` array trong response. KHÔNG return 503 cho 1 source riêng — single envelope 200 OK với error array (xem §4).

### 1.3 GUARD-08 fallback

Không tin 30 ngày → `sentiment_label = NEUTRAL, sentiment_score = 0.0, sentiment_reason = "No articles in 30 days"`. Frontend SentimentSummaryWidget render "Không có tin trong 30 ngày" italic note.

---

## 2. Frontend Hooks

### 2.1 `useNews(NewsFilterParams)`

Wrapper trên [`useApiResource`](g01-runtime.md) (cluster 1):

```ts
type NewsFilterParams = {
  source?: NewsSource[];      // multi
  sentiment?: SentimentLabel; // single (ALL = undefined)
  ticker?: string;
  fromIso?: string;
  toIso?: string;
  limit: number;              // default 20
  offset: number;
  mockNewsFailure?: NewsSource;  // dev toggle
};

function useNews(params: NewsFilterParams):
  ApiResource<NewsListResponse>;
```

Path build qua `buildNewsPath(params)` exported từ hook (cụm sau cần prefetch — vd. cluster 5 compare panel show news context).

### 2.2 `useSentimentSummary(ticker: string, days = 30)`

Trigger fetch `GET /api/news/sentiment/{ticker}?days=30` khi user filter ticker. count=0 case → response `{ score_avg: 0, label_counts: { POSITIVE:0, NEUTRAL:0, NEGATIVE:0 }, total: 0, source_breakdown: {} }` — KHÔNG throw.

---

## 3. NewsList Pattern (Infinite Scroll)

```tsx
// Accumulator + IntersectionObserver + de-dup
function NewsList({ resetKey }: { resetKey: string }) {
  const [accumulator, setAccumulator] = useState<NewsArticle[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [resetCounter, setResetCounter] = useState(0);

  // Reset when filter changes (resetKey hash đổi)
  useEffect(() => {
    setAccumulator([]);
    setPageCount(0);
    setResetCounter(c => c + 1);
  }, [resetKey]);

  const { data, loading } = useNews({ ...params, offset: pageCount * 20 });

  // De-dup by article_id when appending
  useEffect(() => {
    if (!data) return;
    setAccumulator(prev => {
      const seen = new Set(prev.map(a => a.article_id));
      return [...prev, ...data.items.filter(a => !seen.has(a.article_id))];
    });
  }, [data]);

  // IntersectionObserver — skip during fetch
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (loading) return;        // ⚠ critical: skip in-flight
        if (entries[0].isIntersecting && accumulator.length < (data?.total ?? 0)) {
          setPageCount(p => p + 1);
        }
      },
      { rootMargin: '200px 0px 200px 0px' }
    );
    if (sentinelRef.current) obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [accumulator.length, data?.total, loading]);

  return ( /* ... cards + sentinel + reached-end footer ... */ );
}
```

### 3.1 Why skip-during-fetch matters

`useApiResource` cancel prior fetch khi path đổi (offset N → N+20). Nếu observer fire trong khi fetch in-flight → page bị mất. Without skip: fast-scroll → accumulator nhảy missing 20 articles.

### 3.2 Why de-dup by article_id

Re-fetch fast scroll → cùng page có thể về 2 lần nếu intersection fire 2 lần trước khi loading state lock. De-dup bảo vệ.

### 3.3 Why resetKey hash (KHÔNG re-mount)

Filter change → component re-mount sẽ phá Intersection observer ref, lose scroll position. Hash filter shape thành string → `useEffect([resetKey])` reset state inside same component tree.

---

## 4. `source_errors` Envelope

**Decision:** 200 OK envelope với `source_errors: NewsSource[]` field, KHÔNG return 503 cho 1 source riêng.

**Lý do:** client cần hiển thị data từ 4 source còn lại + banner cho source lỗi đồng thời. Nếu 503 partial → client phải merge multiple responses.

```json
GET /api/news?source=CAFEF,VNEXPRESS,...
// CafeF down, 4 source khác OK
{
  "success": true,
  "data": {
    "items": [ /* 80 articles từ 4 source */ ],
    "total": 80,
    "limit": 20,
    "offset": 0,
    "source_errors": ["CAFEF"]
  }
}
```

Frontend render `<SourceErrorBanner sources={response.source_errors} />` ở top NewsList khi `source_errors.length > 0`. Banner persistent — user cần biết coverage thiếu.

Đúng spec [GUARD-08 / SRS f10 AC-10-01](../srs/f10-news-sentiment.md).

---

## 5. FIXTURE_NOW_MS Anchor (mock only)

**Mock `news-fixture.ts`** export `FIXTURE_NOW_MS = Date.parse('2026-05-07T08:00:00Z')` — anchor "today" cho:

| Consumer | Use |
|---|---|
| Mock handler `/api/news` | Filter `fromIso/toIso` based on FIXTURE_NOW_MS thay vì `Date.now()` |
| Mock handler `/api/news/sentiment/{ticker}` | 30-day window từ FIXTURE_NOW_MS |
| `<NewsCard>` `relativeTime()` helper | Compute "X giờ trước" từ FIXTURE_NOW_MS |

**Lý do:** fixture neo articles vào `2026-05-07` (memory `currentDate`). Nếu dùng `Date.now()` → user chạy app ở wall-clock khác fixture date → 30-day window count=0 (giả vờ GUARD-08 fallback nhưng thực ra là bug). Cluster 4 round-2 audit phát hiện và fix.

**Backend phase:** thay FIXTURE_NOW_MS bằng `datetime.now(UTC)` thực vì articles real có `published_at` thật. Frontend KHÔNG đổi (chỉ đọc `crawled_at` / `published_at` từ response).

---

## 6. SentimentSummaryWidget — CSS conic-gradient

**Decision:** dùng CSS `conic-gradient` 3-segment + inset white circle cho doughnut effect, KHÔNG Recharts pie.

**Lý do:** chart 3 slice đơn giản, Recharts pie overhead lớn (SVG render + animation + tooltip system) — vô lý. Conic gradient pure CSS, re-render theme đổi tự động qua CSS var.

```tsx
<div
  className="size-32 rounded-full"
  style={{
    background: `conic-gradient(
      var(--sentiment-positive) 0% ${posPct}%,
      var(--sentiment-neutral)  ${posPct}% ${posPct + neuPct}%,
      var(--sentiment-negative) ${posPct + neuPct}% 100%
    )`,
  }}
>
  {/* inset white circle cho doughnut */}
  <div className="size-20 rounded-full bg-card" />
</div>
```

count=0 → render "Không có tin trong 30 ngày — sentiment NEUTRAL/0.0" italic note (GUARD-08 fallback).

Xem [design.md §6.12](../design.md) cho component spec đầy đủ.
