"""Screening endpoints — TAD g02 §1 + SRS f01.

POST /api/run                       → 202 {run_id, status}
GET  /api/runs?limit&offset         → 200 {items, total, limit, offset}
GET  /api/runs/{run_id}             → 200 {summary}
GET  /api/runs/{run_id}/status      → 200 {status, progress_percent, current_step, ...}
DELETE /api/runs/{run_id}           → 200 + envelope (TAD g02 §8.1)
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Path, Query, status
from sqlalchemy.orm import Session

from app.constants.enums import RunStatus
from app.constants.error_codes import ERR_JOB_CONFLICT, ERR_NOT_FOUND
from app.core.envelope import success
from app.core.errors import AppError
from app.dependencies import CurrentUser, DbSession
from app.job_lock import job_lock
from app.repositories import excluded_repo, results_repo, screening_repo
from app.schemas.run import RunRequest
from app.services import screening_service

router = APIRouter(tags=["screening"])


def _new_run_id() -> str:
    return f"run_{uuid.uuid4().hex[:12]}"


def _conflict() -> AppError:
    return AppError(
        ERR_JOB_CONFLICT,
        f"Đang có tác vụ chạy: {job_lock.active_type}. Vui lòng đợi hoàn thành.",
        http_status=409,
    )


def _load_settings_version(db: Session) -> int:
    from app.models import Settings as SettingsRow

    s = db.get(SettingsRow, 1)
    return int(s.version) if s else 1


def _load_thresholds_json(db: Session) -> str:
    from app.models import Settings as SettingsRow

    s = db.get(SettingsRow, 1)
    if s is None:
        return json.dumps({"buy": 75, "hold_min": 45})
    return json.dumps({"buy": int(s.buy_threshold), "hold_min": int(s.hold_min_threshold)})


@router.post("/run", status_code=status.HTTP_202_ACCEPTED)
def post_run(
    body: RunRequest,
    bg: BackgroundTasks,
    _user: CurrentUser,
    db: DbSession,
) -> dict:
    run_id = _new_run_id()
    if not job_lock.try_acquire(run_id, "screening"):
        raise _conflict()

    try:
        screening_repo.create_run(
            db,
            run_id=run_id,
            run_at=datetime.now(UTC),
            status=RunStatus.PENDING.value,
            model_version=screening_service.MODEL_VERSION,
            settings_version=_load_settings_version(db),
            total_capital=body.total_capital,
            thresholds_json=_load_thresholds_json(db),
        )
        db.commit()
    except Exception:
        # If DB insert fails, release lock so user có thể retry
        job_lock.release(run_id, status=RunStatus.FAILED.value, error="db_create_failed")
        raise

    bg.add_task(
        screening_service.run_screening,
        run_id,
        total_capital=body.total_capital,
        skip_allocation=body.skip_allocation,
    )
    return success({"run_id": run_id, "status": RunStatus.PENDING.value})


@router.get("/runs/{run_id}/status")
def get_run_status(
    _user: CurrentUser,
    db: DbSession,
    run_id: Annotated[str, Path(min_length=1)],
) -> dict:
    row = screening_repo.get(db, run_id)
    if row is None:
        raise AppError(ERR_NOT_FOUND, "Run không tồn tại", http_status=404)

    started_at = row.run_at.isoformat() if row.run_at else None
    completed_at = row.completed_at.isoformat() if row.completed_at else None
    duration: float | None
    if row.duration_seconds is not None:
        duration = float(row.duration_seconds)
    elif row.run_at and row.status not in {
        RunStatus.COMPLETED.value,
        RunStatus.COMPLETED_WITH_WARNINGS.value,
        RunStatus.FAILED.value,
    }:
        # live duration cho active run
        now = datetime.now(UTC)
        ref = row.run_at if row.run_at.tzinfo else row.run_at.replace(tzinfo=UTC)
        duration = round((now - ref).total_seconds(), 3)
    else:
        duration = None

    return success(
        {
            "run_id": row.run_id,
            "status": row.status,
            "progress_percent": int(row.progress_percent or 0),
            "current_step": row.current_step,
            "started_at": started_at,
            "completed_at": completed_at,
            "duration_seconds": duration,
            "run_error": row.run_error,
        }
    )


@router.get("/runs/{run_id}")
def get_run_summary(
    _user: CurrentUser,
    db: DbSession,
    run_id: Annotated[str, Path(min_length=1)],
) -> dict:
    row = screening_repo.get(db, run_id)
    if row is None:
        raise AppError(ERR_NOT_FOUND, "Run không tồn tại", http_status=404)

    warnings: list[str] = json.loads(row.warnings_json) if row.warnings_json else []
    duration = float(row.duration_seconds) if row.duration_seconds is not None else None

    return success(
        {
            "run_id": row.run_id,
            "run_at": row.run_at.isoformat() if row.run_at else None,
            "status": row.status,
            "model_version": row.model_version,
            "settings_version": int(row.settings_version),
            "total_capital": float(row.total_capital or 0),
            "data_from_cache": bool(row.data_from_cache),
            "total_input": int(row.total_input or 0),
            "after_round_1": int(row.after_round_1 or 0),
            "after_round_2": int(row.after_round_2 or 0),
            "after_round_3": int(row.after_round_3 or 0),
            "after_round_4": int(row.after_round_4 or 0),
            "scored_count": int(row.scored_count or 0),
            "buy_count": int(row.buy_count or 0),
            "hold_count": int(row.hold_count or 0),
            "sell_count": int(row.sell_count or 0),
            "duration_seconds": duration,
            "warnings": warnings,
            "run_error": row.run_error,
        }
    )


@router.get("/runs")
def get_runs(
    _user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    items, total = screening_repo.list_paginated(db, limit=limit, offset=offset)
    summaries = []
    for row in items:
        warnings: list[str] = json.loads(row.warnings_json) if row.warnings_json else []
        scored = int(row.scored_count or 0)
        avg_score = 0.0
        if scored > 0:
            results = results_repo.list_by_run(db, row.run_id)
            if results:
                avg_score = round(sum(float(r.ai_score) for r in results if r.ai_score is not None) / len(results), 2)
        summaries.append(
            {
                "run_id": row.run_id,
                "run_at": row.run_at.isoformat() if row.run_at else None,
                "status": row.status,
                "scored_count": scored,
                "buy_count": int(row.buy_count or 0),
                "hold_count": int(row.hold_count or 0),
                "sell_count": int(row.sell_count or 0),
                "model_version": row.model_version,
                "settings_version": int(row.settings_version),
                "duration_seconds": float(row.duration_seconds or 0.0),
                "warnings_count": len(warnings),
                "avg_score": avg_score,
            }
        )
    return success({"items": summaries, "total": total, "limit": limit, "offset": offset})


@router.delete("/runs/{run_id}")
def delete_run(
    _user: CurrentUser,
    db: DbSession,
    run_id: Annotated[str, Path(min_length=1)],
) -> dict:
    if screening_repo.get(db, run_id) is None:
        raise AppError(ERR_NOT_FOUND, "Run không tồn tại", http_status=404)
    # Cascade — children trước parent (FK ON DELETE chưa wire trong schema)
    results_repo.delete_by_run(db, run_id)
    excluded_repo.delete_by_run(db, run_id)
    screening_repo.delete_run(db, run_id)
    db.commit()
    return success({"run_id": run_id, "deleted": True})
