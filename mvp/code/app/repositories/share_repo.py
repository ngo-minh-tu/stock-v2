"""share_links repository — TAD g03 Table 15."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.share import ShareLink


def create(
    db: Session,
    *,
    token: str,
    run_id: str,
    created_at: datetime,
    expires_at: datetime,
) -> ShareLink:
    row = ShareLink(
        token=token,
        run_id=run_id,
        created_at=created_at,
        expires_at=expires_at,
    )
    db.add(row)
    db.flush()
    return row


def get_by_token(db: Session, token: str) -> ShareLink | None:
    return db.scalar(select(ShareLink).where(ShareLink.token == token))


def list_active(db: Session, *, now: datetime) -> list[ShareLink]:
    """Items chưa expire, sort newest first."""
    stmt = (
        select(ShareLink)
        .where(ShareLink.expires_at > now)
        .order_by(desc(ShareLink.created_at))
    )
    return list(db.scalars(stmt))


def delete(db: Session, row: ShareLink) -> None:
    db.delete(row)
