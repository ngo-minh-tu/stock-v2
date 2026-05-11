"""News + Sentiment schemas — TAD g02 §7.2-7.3."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class NewsArticleItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: int
    source: str
    title: str
    url: str
    published_at: str | None  # ISO
    content_snippet: str | None
    related_tickers: list[str]
    sentiment_label: str | None
    sentiment_score: float | None
    sentiment_reason: str | None


class NewsListResponse(BaseModel):
    """`source_errors` luôn tồn tại (có thể empty) — TAD g02 §7.2."""

    model_config = ConfigDict(extra="forbid")
    items: list[NewsArticleItem]
    total: int
    limit: int
    offset: int
    source_errors: list[str]


class SentimentSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    score_avg: float
    label_counts: dict[str, int]
    source_breakdown: dict[str, int]
    total: int
