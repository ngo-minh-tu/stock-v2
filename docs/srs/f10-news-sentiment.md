---
name: SRS-10 News & Sentiment
description: Crawl 5 nguồn tin (RSS first → HTML fallback) và phân tích sentiment POSITIVE/NEUTRAL/NEGATIVE với citation bắt buộc. Phase 3.
type: feature
module: SRS-10
prd_fr: FR-11
phase: 3
---

# F10 — News & Sentiment

> Parent: [00-system-overview.md](00-system-overview.md)
> Related — features: [f02-feature-engineering.md](f02-feature-engineering.md) (S01-S03)
> Related — global: [g01](g01-global-errors-and-validation.md) (ERR-10-*), [g03](g03-appendix-enums-constants.md) (SentimentLabel, NewsSource enums)

## UC-10-01: Crawl & Analyze News

### Crawl Order
RSS first → HTML fallback → skip if blocked

### Per Article Record

```
{
  article_id: auto,
  source: enum(CAFEF | VNEXPRESS | VIETSTOCK | BATDONGSAN | THANHNIEN),
  title: string,
  url: string,
  published_at: datetime,
  related_tickers: string[],        // extracted from content
  sentiment_label: enum(POSITIVE | NEUTRAL | NEGATIVE),
  sentiment_score: float (-1.0 to +1.0),
  sentiment_reason: string,          // article title + source + date
  crawled_at: datetime
}
```

### Sentiment Rules (GUARD-08)

| Rule | Detail |
|---|---|
| Output enum | Chỉ POSITIVE / NEUTRAL / NEGATIVE |
| Score range | -1.0 to +1.0, 2 decimal places |
| Reason | MUST cite article title + source name + published date |
| No articles 30 days | sentiment_label = NEUTRAL, score = 0.0, reason = "No articles in 30 days" |
| Source down | Skip source, log warning, crawl remaining sources |
| Unknown ticker | Article không map to any whitelist ticker → store but exclude from scoring |

### Acceptance Criteria

| AC ID | Criteria |
|---|---|
| AC-10-01 | Nếu CafeF lỗi → skip + crawl 4 nguồn còn lại |
| AC-10-02 | Mỗi article có source + title + url + date + sentiment |
| AC-10-03 | sentiment_score trong range [-1.0, +1.0] |
| AC-10-04 | sentiment_reason chứa article title (không generic) |
| AC-10-05 | Không tin 30 ngày → S01 = 0.0, label = NEUTRAL |
