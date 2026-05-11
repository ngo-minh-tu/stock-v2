"""News + Sentiment query — TAD g02 §7.2-7.3."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime

from sqlalchemy.orm import Session

from app.repositories import news_repo


def list_news(
    db: Session,
    *,
    limit: int = 20,
    offset: int = 0,
    sources: Iterable[str] | None = None,
    sentiment: str | None = None,
    ticker: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    mock_news_failure: str | None = None,
) -> dict:
    """Return shape khớp `NewsListResponse` (TAD g02 §7.2). `source_errors` luôn array.

    `mock_news_failure` (dev only): pass-through 1 source name → echo trong source_errors[]
    KHÔNG remove articles của source đó. Frontend banner test acceptance #11.
    """
    rows, total = news_repo.list_paginated(
        db,
        limit=limit,
        offset=offset,
        sources=sources,
        sentiment=sentiment,
        ticker=ticker,
        from_date=from_date,
        to_date=to_date,
    )

    items = []
    for r in rows:
        items.append(
            {
                "id": int(r.id),
                "source": r.source,
                "title": r.title,
                "url": r.url,
                "published_at": r.published_at.isoformat() if r.published_at else None,
                "content_snippet": r.content_snippet,
                "related_tickers": news_repo.parse_related_tickers(r.related_tickers_json),
                "sentiment_label": r.sentiment_label,
                "sentiment_score": float(r.sentiment_score) if r.sentiment_score is not None else None,
                "sentiment_reason": r.sentiment_reason,
            }
        )

    source_errors: list[str] = []
    if mock_news_failure:
        source_errors.append(mock_news_failure)

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "source_errors": source_errors,
    }


def sentiment_summary(
    db: Session,
    *,
    ticker: str,
    days: int = 30,
    now: datetime | None = None,
) -> dict:
    """30-day rollup. Empty (count=0) → score_avg=0, label_counts all 0, source_breakdown={}."""
    return news_repo.sentiment_summary(db, ticker=ticker, days=days, now=now)
