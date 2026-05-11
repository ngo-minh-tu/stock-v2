"""screening_results bulk insert + query — TAD g03 Table 6."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.run import ScreeningResult


def bulk_insert(db: Session, rows: list[dict]) -> int:
    """Insert nhiều screening_results trong 1 batch. Caller chuẩn bị dict đầy đủ field."""
    if not rows:
        return 0
    db.bulk_insert_mappings(ScreeningResult, rows)
    return len(rows)


def list_by_run(db: Session, run_id: str) -> list[ScreeningResult]:
    return list(db.scalars(select(ScreeningResult).where(ScreeningResult.run_id == run_id)))


def get_by_run_ticker(db: Session, run_id: str, ticker: str) -> ScreeningResult | None:
    stmt = select(ScreeningResult).where(
        ScreeningResult.run_id == run_id,
        ScreeningResult.ticker == ticker,
    )
    return db.scalar(stmt)


def delete_by_run(db: Session, run_id: str) -> int:
    """Xoá tất cả results của 1 run (cascade khi DELETE /runs/{id})."""
    res = db.execute(delete(ScreeningResult).where(ScreeningResult.run_id == run_id))
    return int(res.rowcount or 0)
