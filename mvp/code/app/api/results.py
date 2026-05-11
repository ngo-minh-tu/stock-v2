"""Read APIs scoped to a run — TAD g02 §4 + §8.3 + SRS f04/f06/f07/f08/f12.

Endpoints:
- GET /runs/{run_id}/results        — full results array (Top MUA + Dashboard table)
- GET /runs/{run_id}/excluded       — Red Flags page (cluster prompt §5 — NEW endpoint)
- GET /runs/{run_id}/stocks/{ticker} — Stock Detail full schema
- GET /runs/{run_id}/dashboard      — 5 KPI + 5 chart aggregates
- GET /runs/{run_id_a}/compare/{run_id_b} — 4-section diff
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path
from sqlalchemy import select

from app.constants.error_codes import ERR_COMPARE_SAME_RUN, ERR_NOT_FOUND
from app.core.envelope import success
from app.core.errors import AppError
from app.dependencies import CurrentUser, DbSession
from app.models.stock import Stock
from app.repositories import excluded_repo, results_repo, screening_repo
from app.services import compare_service, dashboard_service, results_service

router = APIRouter(tags=["read"])


def _require_run(db, run_id: str):
    row = screening_repo.get(db, run_id)
    if row is None:
        raise AppError(ERR_NOT_FOUND, "Run không tồn tại", http_status=404)
    return row


@router.get("/runs/{run_id}/results")
def get_run_results(
    _user: CurrentUser,
    db: DbSession,
    run_id: Annotated[str, Path(min_length=1)],
) -> dict:
    _require_run(db, run_id)
    rows = results_repo.list_by_run(db, run_id)
    stocks_by_t = {s.ticker: s for s in db.scalars(select(Stock))}
    payload = [results_service.to_result_row(r, stocks_by_t.get(r.ticker)) for r in rows]
    return success({"results": payload, "total": len(payload)})


@router.get("/runs/{run_id}/excluded")
def get_run_excluded(
    _user: CurrentUser,
    db: DbSession,
    run_id: Annotated[str, Path(min_length=1)],
) -> dict:
    _require_run(db, run_id)
    rows = excluded_repo.list_by_run(db, run_id)
    stocks_by_t = {s.ticker: s for s in db.scalars(select(Stock))}
    items = []
    for r in rows:
        s = stocks_by_t.get(r.ticker)
        items.append(
            {
                "ticker": r.ticker,
                "name": s.name if s else r.ticker,
                "excluded_round": int(r.excluded_round),
                "reason_code": r.reason_code,
                "reason_text": r.reason,  # FE expects `reason_text` (Phase 9 field-name reconcile)
            }
        )
    return success({"items": items, "total": len(items)})


@router.get("/runs/{run_id}/stocks/{ticker}")
def get_run_stock_detail(
    _user: CurrentUser,
    db: DbSession,
    run_id: Annotated[str, Path(min_length=1)],
    ticker: Annotated[str, Path(min_length=1)],
) -> dict:
    _require_run(db, run_id)
    row = results_repo.get_by_run_ticker(db, run_id, ticker.upper())
    if row is None:
        raise AppError(
            ERR_NOT_FOUND,
            f"Mã {ticker} không có trong run này",
            http_status=404,
        )
    stock = db.get(Stock, row.ticker)
    return success(results_service.to_stock_detail(row, stock))


@router.get("/runs/{run_id}/dashboard")
def get_run_dashboard(
    _user: CurrentUser,
    db: DbSession,
    run_id: Annotated[str, Path(min_length=1)],
) -> dict:
    run = _require_run(db, run_id)
    return success(dashboard_service.build_dashboard(db, run))


@router.get("/runs/{run_id_a}/compare/{run_id_b}")
def get_run_compare(
    _user: CurrentUser,
    db: DbSession,
    run_id_a: Annotated[str, Path(min_length=1)],
    run_id_b: Annotated[str, Path(min_length=1)],
) -> dict:
    if run_id_a == run_id_b:
        raise AppError(
            ERR_COMPARE_SAME_RUN,
            "Không thể so sánh cùng 1 run",
            http_status=400,
        )
    a = _require_run(db, run_id_a)
    b = _require_run(db, run_id_b)
    return success(compare_service.compute_compare(db, a, b))
