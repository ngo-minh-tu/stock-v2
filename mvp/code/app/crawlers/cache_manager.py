"""Cache freshness gate — TAD g04 §2.

Two gates, distinct concerns:
- `is_stale()` — TTL-only. Refresh service dùng để quyết định có fetch external lại không.
  Status field (FRESH/STUB/...) cố ý KHÔNG check ở đây để tránh refresh job tự re-trigger
  vô tận sau khi vừa mark STUB (just-refreshed STUB → status≠FRESH → "stale" → fetch lại).
- `is_usable()` — TTL AND status=FRESH. Downstream (screening, UI badges) dùng để gate
  whether the cached data can be trusted. STUB rows survive `is_stale` (TTL ok) nhưng
  KHÔNG usable, đảm bảo `data_from_cache` flag được set đúng cho user-facing warning.
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


def is_usable(db: Session, source_key: str, *, now: datetime | None = None) -> bool:
    """True iff metadata exists, TTL hợp lệ, AND status == 'FRESH'.

    Khác `is_stale()`: STUB rows trả False ở đây nhưng có thể vẫn non-stale theo TTL.
    """
    meta = cache_repo.get(db, source_key)
    if meta is None or meta.last_refreshed_at is None:
        return False
    if (meta.status or "").upper() != "FRESH":
        return False
    elapsed = (now or datetime.now(UTC)) - _aware(meta.last_refreshed_at)
    return elapsed <= timedelta(hours=int(meta.ttl_hours))


def mark_refreshed(db: Session, source_key: str, *, status: str = "FRESH") -> None:
    cache_repo.upsert_refresh(db, source_key=source_key, refreshed_at=datetime.now(UTC), status=status)


def _aware(dt: datetime) -> datetime:
    """SQLite stores naive datetimes — promote to UTC-aware để timedelta arithmetic OK."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt
