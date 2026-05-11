"""excluded_stocks bulk insert + query — TAD g03 Table 7."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.run import ExcludedStock


def bulk_insert(db: Session, rows: list[dict]) -> int:
    if not rows:
        return 0
    db.bulk_insert_mappings(ExcludedStock, rows)
    return len(rows)


def list_by_run(db: Session, run_id: str) -> list[ExcludedStock]:
    return list(db.scalars(select(ExcludedStock).where(ExcludedStock.run_id == run_id)))


def delete_by_run(db: Session, run_id: str) -> int:
    res = db.execute(delete(ExcludedStock).where(ExcludedStock.run_id == run_id))
    return int(res.rowcount or 0)
