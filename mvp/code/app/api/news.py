"""News + Sentiment endpoints — TAD g02 §7.2-7.3 + SRS f10."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.core.envelope import success
from app.dependencies import CurrentUser, DbSession
from app.services import news_crawl_service, news_service

router = APIRouter(tags=["news"])


def _parse_csv(value: str | None) -> list[str] | None:
    if not value:
        return None
    parts = [p.strip().upper() for p in value.split(",") if p.strip()]
    return parts or None


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.get("/news")
def get_news(
    _user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    source: Annotated[str | None, Query(description="CSV NewsSource[]")] = None,
    sentiment: Annotated[str | None, Query()] = None,
    ticker: Annotated[str | None, Query()] = None,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: Annotated[str | None, Query()] = None,
    mock_news_failure: Annotated[str | None, Query()] = None,
) -> dict:
    return success(
        news_service.list_news(
            db,
            limit=limit,
            offset=offset,
            sources=_parse_csv(source),
            sentiment=sentiment.upper() if sentiment else None,
            ticker=ticker.upper() if ticker else None,
            from_date=_parse_date(from_),
            to_date=_parse_date(to),
            mock_news_failure=mock_news_failure.upper() if mock_news_failure else None,
        )
    )


@router.get("/news/sentiment/{ticker}")
def get_news_sentiment(
    _user: CurrentUser,
    db: DbSession,
    ticker: Annotated[str, Path(min_length=1)],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> dict:
    return success(news_service.sentiment_summary(db, ticker=ticker.upper(), days=days))


@router.post("/news/refresh")
def refresh_news(_user: CurrentUser, db: DbSession) -> dict:
    """Crawl 5 nguồn (CafeF/VnExpress/Vietstock/Batdongsan/ThanhNien) → classify → upsert.

    SRS f10 AC-10-01: source down → skip + source_errors[]. Response 200 OK.
    TAD c04 §1: RSS first → HTML fallback → skip if blocked.
    """
    return success(news_crawl_service.refresh_news(db))
