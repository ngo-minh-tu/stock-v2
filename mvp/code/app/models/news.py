"""Table 8: news_articles — TAD g03."""

from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.session import Base


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    content_snippet: Mapped[str | None] = mapped_column(Text)
    related_tickers_json: Mapped[str | None] = mapped_column(Text)
    sentiment_label: Mapped[str | None] = mapped_column(String)
    sentiment_score: Mapped[float | None] = mapped_column(Numeric)
    sentiment_reason: Mapped[str | None] = mapped_column(Text)
    crawled_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (
        Index("idx_news_published", "published_at"),
        Index("idx_news_source", "source"),
    )
