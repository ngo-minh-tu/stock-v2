"""Refresh endpoints — TAD g02 §1."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Path, status

from app.constants.enums import RefreshStatus
from app.constants.error_codes import ERR_JOB_CONFLICT, ERR_NOT_FOUND
from app.core.envelope import success
from app.core.errors import AppError
from app.dependencies import CurrentUser
from app.job_lock import job_lock
from app.schemas.refresh import RefreshPricesRequest
from app.services import refresh_service

router = APIRouter(prefix="/refresh", tags=["refresh"])


def _new_refresh_id() -> str:
    return f"refresh_{uuid.uuid4().hex[:12]}"


def _conflict() -> AppError:
    return AppError(
        ERR_JOB_CONFLICT,
        f"Đang có tác vụ chạy: {job_lock.active_type}. Vui lòng đợi hoàn thành.",
        http_status=409,
    )


@router.post("/all", status_code=status.HTTP_202_ACCEPTED)
def post_refresh_all(bg: BackgroundTasks, _user: CurrentUser) -> dict:
    refresh_id = _new_refresh_id()
    if not job_lock.try_acquire(refresh_id, "refresh"):
        raise _conflict()
    bg.add_task(refresh_service.run_refresh_all, refresh_id)
    return success({"refresh_id": refresh_id, "status": RefreshStatus.PENDING.value})


@router.post("/prices", status_code=status.HTTP_202_ACCEPTED)
def post_refresh_prices(
    bg: BackgroundTasks,
    _user: CurrentUser,
    body: RefreshPricesRequest | None = None,
) -> dict:
    refresh_id = _new_refresh_id()
    if not job_lock.try_acquire(refresh_id, "refresh"):
        raise _conflict()
    req = body or RefreshPricesRequest()
    bg.add_task(
        refresh_service.run_refresh_prices,
        refresh_id,
        tickers=req.tickers,
        resume_failed=req.resume_failed,
    )
    return success({"refresh_id": refresh_id, "status": RefreshStatus.PENDING.value})


@router.get("/{refresh_id}/status")
def get_refresh_status(
    _user: CurrentUser,
    refresh_id: Annotated[str, Path(min_length=1)],
) -> dict:
    job = job_lock.get(refresh_id)
    if job is None:
        raise AppError(ERR_NOT_FOUND, "Refresh không tồn tại", http_status=404)
    return success(
        {
            "refresh_id": job["job_id"],
            "type": job["type"],
            "status": job["status"],
            "progress": job["progress"],
            "message": job["message"],
            "started_at": job["started_at"],
            "finished_at": job["finished_at"],
            "error": job["error"],
            "stats": job.get("stats", {}),
        }
    )
