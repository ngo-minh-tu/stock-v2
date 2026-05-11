"""screening_runs CRUD — TAD g03 Table 5."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.run import ScreeningRun


def create_run(
    db: Session,
    *,
    run_id: str,
    run_at: datetime,
    status: str,
    model_version: str,
    settings_version: int,
    total_capital: float,
    thresholds_json: str | None,
) -> ScreeningRun:
    row = ScreeningRun(
        run_id=run_id,
        run_at=run_at,
        status=status,
        model_version=model_version,
        settings_version=settings_version,
        total_capital=total_capital,
        thresholds_json=thresholds_json,
        progress_percent=0,
    )
    db.add(row)
    return row


def get(db: Session, run_id: str) -> ScreeningRun | None:
    return db.get(ScreeningRun, run_id)


def update_status(
    db: Session,
    run_id: str,
    *,
    status: str | None = None,
    current_step: str | None = None,
    progress_percent: int | None = None,
    run_error: str | None = None,
) -> None:
    row = db.get(ScreeningRun, run_id)
    if row is None:
        return
    if status is not None:
        row.status = status
    if current_step is not None:
        row.current_step = current_step
    if progress_percent is not None:
        row.progress_percent = progress_percent
    if run_error is not None:
        row.run_error = run_error


def update_counts(
    db: Session,
    run_id: str,
    *,
    total_input: int | None = None,
    after_round_1: int | None = None,
    after_round_2: int | None = None,
    after_round_3: int | None = None,
    after_round_4: int | None = None,
    scored_count: int | None = None,
    buy_count: int | None = None,
    hold_count: int | None = None,
    sell_count: int | None = None,
    data_from_cache: bool | None = None,
    warnings_json: str | None = None,
) -> None:
    row = db.get(ScreeningRun, run_id)
    if row is None:
        return
    if total_input is not None:
        row.total_input = total_input
    if after_round_1 is not None:
        row.after_round_1 = after_round_1
    if after_round_2 is not None:
        row.after_round_2 = after_round_2
    if after_round_3 is not None:
        row.after_round_3 = after_round_3
    if after_round_4 is not None:
        row.after_round_4 = after_round_4
    if scored_count is not None:
        row.scored_count = scored_count
    if buy_count is not None:
        row.buy_count = buy_count
    if hold_count is not None:
        row.hold_count = hold_count
    if sell_count is not None:
        row.sell_count = sell_count
    if data_from_cache is not None:
        row.data_from_cache = data_from_cache
    if warnings_json is not None:
        row.warnings_json = warnings_json


def mark_completed(
    db: Session,
    run_id: str,
    *,
    status: str,
    completed_at: datetime,
    duration_seconds: float,
) -> None:
    row = db.get(ScreeningRun, run_id)
    if row is None:
        return
    row.status = status
    row.completed_at = completed_at
    row.duration_seconds = duration_seconds
    row.progress_percent = 100


def list_paginated(db: Session, *, limit: int = 10, offset: int = 0) -> tuple[list[ScreeningRun], int]:
    total = db.scalar(select(func.count()).select_from(ScreeningRun)) or 0
    items = list(
        db.scalars(
            select(ScreeningRun)
            .order_by(desc(ScreeningRun.run_at))
            .limit(limit)
            .offset(offset)
        )
    )
    return items, int(total)


def delete_run(db: Session, run_id: str) -> bool:
    row = db.get(ScreeningRun, run_id)
    if row is None:
        return False
    db.delete(row)
    return True


def latest_n_run_ids(db: Session, n: int = 10) -> list[str]:
    return list(
        db.scalars(
            select(ScreeningRun.run_id).order_by(desc(ScreeningRun.run_at)).limit(n)
        )
    )


def latest_completed(db: Session) -> ScreeningRun | None:
    """Most recent run với status terminal (COMPLETED|COMPLETED_WITH_WARNINGS).

    Dùng cho `current_price` fallback trên Price Board (TAD g02 §7.1).
    """
    stmt = (
        select(ScreeningRun)
        .where(ScreeningRun.status.in_(("COMPLETED", "COMPLETED_WITH_WARNINGS")))
        .order_by(desc(ScreeningRun.run_at))
        .limit(1)
    )
    return db.scalar(stmt)
