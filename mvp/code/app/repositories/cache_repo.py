"""Cache metadata repository — TAD g04."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models import CacheMetadata


def get(db: Session, source_key: str) -> CacheMetadata | None:
    return db.get(CacheMetadata, source_key)


def upsert_refresh(
    db: Session,
    *,
    source_key: str,
    refreshed_at: datetime,
    status: str = "FRESH",
) -> CacheMetadata:
    row = db.get(CacheMetadata, source_key)
    if row is None:
        # Source chưa được seed (e.g. dynamically added) — fallback ttl 24h
        row = CacheMetadata(source=source_key, ttl_hours=24)
        db.add(row)
    row.last_refreshed_at = refreshed_at
    row.status = status
    db.flush()
    return row
