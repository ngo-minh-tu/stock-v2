"""Share Link service — TAD c06 §3 + g02 §9.2 + SRS f13 UC-13-02.

Token: uuid v4 (crypto-strong) per TAD c06 §3.1.
TTL: 7 days default, override via `expires_in_days` request body (1-365).
URL: relative `/share/{token}` per TAD c06 §4 production guidance — frontend prepend
`window.location.origin` runtime. KHÔNG hardcode `https://app.example/...` mock URL.

Public route GET /share/{token} bypasses auth; 404 nếu invalid hoặc expired.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.constants.error_codes import ERR_NOT_FOUND, ERR_SHARE_TOKEN_INVALID
from app.constants.thresholds import SHARE_DEFAULT_EXPIRES_DAYS
from app.core.errors import AppError
from app.models.share import ShareLink
from app.repositories import screening_repo, share_repo


def _now_naive_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _serialize(row: ShareLink) -> dict:
    return {
        "token": row.token,
        "run_id": row.run_id,
        "url": f"/share/{row.token}",
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "expires_at": row.expires_at.isoformat() if row.expires_at else "",
    }


def create_link(
    db: Session,
    *,
    run_id: str,
    expires_in_days: int = SHARE_DEFAULT_EXPIRES_DAYS,
) -> dict:
    if screening_repo.get(db, run_id) is None:
        raise AppError(ERR_NOT_FOUND, "Run không tồn tại", http_status=404)
    now = _now_naive_utc()
    expires_at = now + timedelta(days=expires_in_days)
    token = str(uuid.uuid4())
    row = share_repo.create(
        db,
        token=token,
        run_id=run_id,
        created_at=now,
        expires_at=expires_at,
    )
    return _serialize(row)


def list_active_links(db: Session) -> list[dict]:
    rows = share_repo.list_active(db, now=_now_naive_utc())
    return [_serialize(r) for r in rows]


def get_active_link(db: Session, token: str) -> ShareLink:
    """Public route — 404 nếu invalid hoặc expired."""
    row = share_repo.get_by_token(db, token)
    if row is None:
        raise AppError(ERR_SHARE_TOKEN_INVALID, "Link không hợp lệ", http_status=404)
    if row.expires_at and row.expires_at <= _now_naive_utc():
        raise AppError(ERR_SHARE_TOKEN_INVALID, "Link đã hết hạn", http_status=404)
    return row


def delete_link(db: Session, token: str) -> str:
    row = share_repo.get_by_token(db, token)
    if row is None:
        raise AppError(ERR_NOT_FOUND, "Link không tồn tại", http_status=404)
    share_repo.delete(db, row)
    return token
