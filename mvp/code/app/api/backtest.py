"""Backtest endpoints — TAD g02 §1 + §8.5-8.6 + SRS f12 UC-12-03.

POST /api/backtest                  → 202 {backtest_id, status: PENDING}
GET  /api/backtest/{id}/status      → 200 {status, started_at, completed_at}
GET  /api/backtest/{id}             → 200 {metrics + roi_curve}
GET  /api/backtest/{id}/results     → 200 {results[]}
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Path, status

from app.constants.error_codes import ERR_NOT_FOUND
from app.core.envelope import success
from app.core.errors import AppError
from app.dependencies import CurrentUser, DbSession
from app.repositories import backtest_repo, screening_repo
from app.schemas.backtest import BacktestStartRequest
from app.services import backtest_service

router = APIRouter(prefix="/backtest", tags=["backtest"])


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def start_backtest(
    body: BacktestStartRequest,
    bg: BackgroundTasks,
    db: DbSession,
    _user: CurrentUser,
) -> dict:
    backtest_id = backtest_service.start_backtest(
        db,
        period_from=body.period_from,
        period_to=body.period_to,
    )
    baseline_run = screening_repo.latest_completed(db)
    bg.add_task(
        backtest_service.run_backtest,
        backtest_id,
        baseline_run_id=baseline_run.run_id,
    )
    return success({"backtest_id": backtest_id, "status": "PENDING"})


@router.get("/{backtest_id}/status")
def get_status(
    db: DbSession,
    _user: CurrentUser,
    backtest_id: Annotated[int, Path(ge=1)],
) -> dict:
    row = backtest_repo.get(db, backtest_id)
    if row is None:
        raise AppError(ERR_NOT_FOUND, "Backtest không tồn tại", http_status=404)
    return success(
        {
            "backtest_id": int(row.id),
            "status": row.status,
            "started_at": row.started_at.isoformat() if row.started_at else None,
            "completed_at": row.completed_at.isoformat() if row.completed_at else None,
        }
    )


@router.get("/{backtest_id}")
def get_metrics(
    db: DbSession,
    _user: CurrentUser,
    backtest_id: Annotated[int, Path(ge=1)],
) -> dict:
    row = backtest_repo.get(db, backtest_id)
    if row is None:
        raise AppError(ERR_NOT_FOUND, "Backtest không tồn tại", http_status=404)
    raw_results = backtest_repo.list_results(db, backtest_id)
    results = [
        {
            "ticker": r.ticker,
            "predicted_recommendation": r.predicted_recommendation,
            "predicted_price": float(r.predicted_price or 0.0),
            "actual_price": float(r.actual_price or 0.0),
            "price_error_pct": float(r.price_error_pct or 0.0),
            "actual_return_3m": float(r.actual_return_3m or 0.0),
            "recommendation_correct": bool(r.recommendation_correct),
        }
        for r in raw_results
    ]
    return success(backtest_service.get_metrics(db, row, results))


@router.get("/{backtest_id}/results")
def get_results(
    db: DbSession,
    _user: CurrentUser,
    backtest_id: Annotated[int, Path(ge=1)],
) -> dict:
    row = backtest_repo.get(db, backtest_id)
    if row is None:
        raise AppError(ERR_NOT_FOUND, "Backtest không tồn tại", http_status=404)
    rows = backtest_repo.list_results(db, backtest_id)
    items = [
        {
            "ticker": r.ticker,
            "predicted_recommendation": r.predicted_recommendation,
            "predicted_price": float(r.predicted_price or 0.0),
            "actual_price": float(r.actual_price or 0.0),
            "price_error_pct": float(r.price_error_pct or 0.0),
            "actual_return_3m": float(r.actual_return_3m or 0.0),
            "recommendation_correct": bool(r.recommendation_correct),
        }
        for r in rows
    ]
    return success({"results": items})
