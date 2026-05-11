"""Cache freshness gate — TAD g04 §2.

Pure function: đọc cache_metadata row → check stale theo `ttl_hours`. Refresh service
gọi `is_stale(db, source)` trước khi fetch external; UI/screening gọi để bật badge
STALE_DATA hoặc set `data_from_cache=true`.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.repositories import cache_repo


def is_stale(db: Session, source_key: str, *, now: datetime | None = None) -> bool:
    meta = cache_repo.get(db, source_key)
    if meta is None or meta.last_refreshed_at is None:
        return True
    elapsed = (now or datetime.now(UTC)) - _aware(meta.last_refreshed_at)
    return elapsed > timedelta(hours=int(meta.ttl_hours))


def mark_refreshed(db: Session, source_key: str, *, status: str = "FRESH") -> None:
    cache_repo.upsert_refresh(db, source_key=source_key, refreshed_at=datetime.now(UTC), status=status)


def _aware(dt: datetime) -> datetime:
    """SQLite stores naive datetimes — promote to UTC-aware để timedelta arithmetic OK."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt
