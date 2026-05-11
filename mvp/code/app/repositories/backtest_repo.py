"""backtest_runs + backtest_results repository — TAD g03 Tables 13-14."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.backtest import BacktestResult, BacktestRun


def create_run(
    db: Session,
    *,
    period_from: date,
    period_to: date,
    started_at: datetime,
    status: str = "PENDING",
) -> BacktestRun:
    row = BacktestRun(
        period_from=period_from,
        period_to=period_to,
        started_at=started_at,
        status=status,
    )
    db.add(row)
    db.flush()
    return row


def get(db: Session, backtest_id: int) -> BacktestRun | None:
    return db.get(BacktestRun, backtest_id)


def update_status(db: Session, backtest_id: int, *, status: str) -> None:
    row = db.get(BacktestRun, backtest_id)
    if row is not None:
        row.status = status


def mark_completed(
    db: Session,
    backtest_id: int,
    *,
    completed_at: datetime,
    recommendation_accuracy: float,
    price_error_mean: float,
    portfolio_roi: float,
    vnindex_roi: float,
    alpha: float,
) -> None:
    row = db.get(BacktestRun, backtest_id)
    if row is None:
        return
    row.status = "COMPLETED"
    row.completed_at = completed_at
    row.recommendation_accuracy = recommendation_accuracy
    row.price_error_mean = price_error_mean
    row.portfolio_roi = portfolio_roi
    row.vnindex_roi = vnindex_roi
    row.alpha = alpha


def mark_failed(db: Session, backtest_id: int, *, completed_at: datetime) -> None:
    row = db.get(BacktestRun, backtest_id)
    if row is None:
        return
    row.status = "FAILED"
    row.completed_at = completed_at


def insert_results(db: Session, backtest_id: int, rows: list[dict]) -> None:
    if not rows:
        return
    db.bulk_insert_mappings(BacktestResult, [{**r, "backtest_id": backtest_id} for r in rows])


def list_results(db: Session, backtest_id: int) -> list[BacktestResult]:
    stmt = (
        select(BacktestResult)
        .where(BacktestResult.backtest_id == backtest_id)
        .order_by(desc(BacktestResult.price_error_pct))
    )
    return list(db.scalars(stmt))
