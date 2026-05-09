---
id: c04
title: News & Sentiment Pipeline
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§14)
---

# c04 — News & Sentiment Pipeline

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f10-news-sentiment.md](../srs/f10-news-sentiment.md)
>
> Related — global: [g03-database.md](g03-database.md) (writes `news_articles`), [g04-cache.md](g04-cache.md) (5 NEWS_* sources, TTL=6h), [g05-cross-cutting.md](g05-cross-cutting.md) (logging on per-source crawl errors)

---

## 1. Pipeline

```
Crawl: RSS first → HTML fallback → skip if blocked
Per article: title, url, source, date, related_tickers, sentiment
Sentiment: POSITIVE/NEUTRAL/NEGATIVE, score -1 to +1 (GUARD-08)
MVP: keyword-based classifier. Target: NLP model.
```
