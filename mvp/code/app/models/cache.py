"""Table 16: cache_metadata — TAD g03 + g04."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CacheMetadata(Base):
    __tablename__ = "cache_metadata"

    source: Mapped[str] = mapped_column(String, primary_key=True)
    last_refreshed_at: Mapped[datetime | None] = mapped_column(DateTime)
    ttl_hours: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="FRESH")
