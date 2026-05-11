"""news_articles query — TAD g03 Table 8 + g02 §7.2-7.3."""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import datetime, timedelta

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.news import NewsArticle


def list_paginated(
    db: Session,
    *,
    limit: int = 20,
    offset: int = 0,
    sources: Iterable[str] | None = None,
    sentiment: str | None = None,
    ticker: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
) -> tuple[list[NewsArticle], int]:
    """Filtered paginated news. Trả về (rows, total).

    `ticker` filter: SQLite không có JSON-array contains; dùng `LIKE %"ticker"%`
    trên `related_tickers_json` (lưu dạng JSON string mảng).
    """
    base = select(NewsArticle)
    if sources:
        src_list = [s for s in sources if s]
        if src_list:
            base = base.where(NewsArticle.source.in_(src_list))
    if sentiment:
        base = base.where(NewsArticle.sentiment_label == sentiment)
    if ticker:
        # related_tickers_json = '["VHM","KDH"]' → tìm `"VHM"`
        base = base.where(NewsArticle.related_tickers_json.like(f'%"{ticker}"%'))
    if from_date is not None:
        base = base.where(NewsArticle.published_at >= from_date)
    if to_date is not None:
        base = base.where(NewsArticle.published_at <= to_date)

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = list(
        db.scalars(
            base.order_by(desc(NewsArticle.published_at)).limit(limit).offset(offset)
        )
    )
    return rows, int(total)


def sentiment_summary(
    db: Session,
    *,
    ticker: str,
    days: int = 30,
    now: datetime | None = None,
) -> dict:
    """30-day rollup cho 1 ticker — TAD g02 §7.3.

    Empty (no articles) → caller wrap thành {NEUTRAL/0.0/empty} envelope.
    """
    if now is None:
        now = datetime.utcnow()
    cutoff = now - timedelta(days=days)

    rows = db.scalars(
        select(NewsArticle)
        .where(
            NewsArticle.published_at >= cutoff,
            NewsArticle.related_tickers_json.like(f'%"{ticker}"%'),
        )
    ).all()

    label_counts = {"POSITIVE": 0, "NEUTRAL": 0, "NEGATIVE": 0}
    source_breakdown: dict[str, int] = {}
    score_sum = 0.0
    score_n = 0
    for row in rows:
        label = row.sentiment_label or "NEUTRAL"
        if label in label_counts:
            label_counts[label] += 1
        if row.source:
            source_breakdown[row.source] = source_breakdown.get(row.source, 0) + 1
        if row.sentiment_score is not None:
            score_sum += float(row.sentiment_score)
            score_n += 1

    return {
        "ticker": ticker,
        "score_avg": round(score_sum / score_n, 2) if score_n else 0.0,
        "label_counts": label_counts,
        "source_breakdown": source_breakdown,
        "total": len(rows),
    }


def parse_related_tickers(json_str: str | None) -> list[str]:
    if not json_str:
        return []
    try:
        data = json.loads(json_str)
        return [str(t) for t in data] if isinstance(data, list) else []
    except (ValueError, TypeError):
        return []
