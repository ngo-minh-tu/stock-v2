"""Share Link endpoints — TAD g02 §1 + §9.2 + SRS f13 UC-13-02.

POST   /api/share              → 201 {token, url, expires_at, ...}    [auth]
GET    /api/share              → 200 {items[]}                         [auth]
GET    /api/share/{token}      → 200 SharedViewResponse                [PUBLIC, no auth]
DELETE /api/share/{token}      → 200 + envelope {token, deleted}       [auth]

Note: GET /api/share/{token} bypasses CurrentUser dependency. 404 nếu invalid hoặc
expired (KHÔNG redirect login). Body chứa raw shared data — caller responsible cho
read-only enforcement ở UI layer (TAD c06 §6 readOnly mode).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, status

from app.core.envelope import success
from app.dependencies import CurrentUser, DbSession
from app.repositories import screening_repo
from app.schemas.share import ShareCreateRequest
from app.services import export_service, share_service

router = APIRouter(prefix="/share", tags=["share"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_share(
    body: ShareCreateRequest,
    db: DbSession,
    _user: CurrentUser,
) -> dict:
    payload = share_service.create_link(
        db,
        run_id=body.run_id,
        expires_in_days=body.expires_in_days,
    )
    db.commit()
    return success(payload)


@router.get("")
def list_shares(db: DbSession, _user: CurrentUser) -> dict:
    items = share_service.list_active_links(db)
    return success({"items": items})


@router.get("/{token}")
def get_shared_view(
    db: DbSession,
    token: Annotated[str, Path(min_length=1)],
) -> dict:
    """PUBLIC — no auth. Token + expiry check trong service."""
    link = share_service.get_active_link(db, token)
    run = screening_repo.get(db, link.run_id)
    if run is None:
        # Run đã bị delete sau khi tạo share — 404 graceful
        from app.constants.error_codes import ERR_SHARE_TOKEN_INVALID
        from app.core.errors import AppError

        raise AppError(ERR_SHARE_TOKEN_INVALID, "Run gốc không còn tồn tại", http_status=404)
    data = export_service.build_share_data(db, run)
    return success(
        {
            "token": link.token,
            "run_id": link.run_id,
            "expires_at": link.expires_at.isoformat() if link.expires_at else "",
            "data": data,
        }
    )


@router.delete("/{token}")
def delete_share(
    db: DbSession,
    _user: CurrentUser,
    token: Annotated[str, Path(min_length=1)],
) -> dict:
    deleted_token = share_service.delete_link(db, token)
    db.commit()
    return success({"token": deleted_token, "deleted": True})
