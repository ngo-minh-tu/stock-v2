"""Orchestrator crawl 5 nguồn → classify → upsert vào `news_articles`.

SRS f10 / TAD c04:
- RSS first → HTML fallback → skip if blocked (per c04 §1)
- Sentiment keyword-based với GUARD-08 citation
- Unknown ticker → store article nhưng không map vào per-ticker sentiment
- Per-source error → log + source_errors[]
"""

from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.crawlers.news_rss import CrawledArticle, crawl_source
from app.crawlers.news_sources import SOURCES
from app.models import NewsArticle
from app.repositories import stock_repo
from app.services.sentiment_rule import classify

# Marker prefix của fixture URL từ Phase 9 seed; lần refresh thật đầu tiên sẽ purge.
LEGACY_FIXTURE_URL_PREFIX = "https://mock.example/"

logger = logging.getLogger(__name__)


def _extract_tickers(text: str, whitelist: set[str]) -> list[str]:
    """Match uppercase tokens 2-5 chars trong text vs whitelist tickers."""
    tokens = set(re.findall(r"\b[A-Z]{2,5}\b", text))
    return sorted(tokens & whitelist)


def _to_db_row(art: CrawledArticle, whitelist: set[str]) -> dict:
    text_for_extract = f"{art.title} {art.content_snippet}"
    tickers = _extract_tickers(text_for_extract, whitelist)
    label, score, reason = classify(
        art.title,
        art.content_snippet,
        source=art.source,
        published_at=art.published_at,
    )
    return {
        "source": art.source,
        "title": art.title,
        "url": art.url,
        "published_at": art.published_at,
        "content_snippet": art.content_snippet or None,
        "related_tickers_json": json.dumps(tickers) if tickers else None,
        "sentiment_label": label,
        "sentiment_score": score,
        "sentiment_reason": reason,
        "crawled_at": datetime.now(UTC),
    }


def refresh_news(db: Session) -> dict:
    """Crawl 5 sources, upsert vào DB. Return stats + source_errors[].

    SRS AC-10-01: source down → skip, response 200 OK + source_errors=[source].
    Dedup theo `news_articles.url` (unique constraint).
    """
    whitelist = set(stock_repo.list_active_tickers(db))

    # Idempotent migration: purge fixture rows từ Phase 9 seed (mock.example URLs).
    purged_legacy = db.execute(
        delete(NewsArticle).where(NewsArticle.url.like(f"{LEGACY_FIXTURE_URL_PREFIX}%"))
    ).rowcount or 0

    inserted = 0
    skipped_dup = 0
    source_errors: list[str] = []
    counts_per_source: dict[str, int] = {}

    for source_cfg in SOURCES:
        articles, err = crawl_source(source_cfg)
        if err:
            logger.warning("source crawl failed: %s", err)
            source_errors.append(source_cfg.code)
            counts_per_source[source_cfg.code] = 0
            continue
        counts_per_source[source_cfg.code] = len(articles)

        # Pre-load existing URLs cho source này → tránh N queries cho dedup
        existing_by_url = {
            row.url: row
            for row in db.scalars(
                select(NewsArticle).where(NewsArticle.source == source_cfg.code)
            )
        }

        for art in articles:
            existing = existing_by_url.get(art.url)
            if existing is not None:
                row = _to_db_row(art, whitelist)
                if existing.published_at is None and row["published_at"] is not None:
                    existing.title = row["title"]
                    existing.published_at = row["published_at"]
                    existing.content_snippet = row["content_snippet"]
                    existing.related_tickers_json = row["related_tickers_json"]
                    existing.sentiment_label = row["sentiment_label"]
                    existing.sentiment_score = row["sentiment_score"]
                    existing.sentiment_reason = row["sentiment_reason"]
                    existing.crawled_at = row["crawled_at"]
                skipped_dup += 1
                continue
            row = _to_db_row(art, whitelist)
            new_article = NewsArticle(**row)
            db.add(new_article)
            existing_by_url[art.url] = new_article
            inserted += 1

    db.commit()
    return {
        "inserted": inserted,
        "skipped_duplicate": skipped_dup,
        "purged_legacy_fixture": purged_legacy,
        "source_errors": source_errors,
        "counts_per_source": counts_per_source,
        "crawled_at": datetime.now(UTC).isoformat(),
    }
