"""financial_reports access — TAD g03 Table 3."""

from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models.financial import FinancialReport

_UPSERT_FIELDS = (
    "year",
    "quarter",
    "revenue",
    "net_income",
    "total_assets",
    "total_equity",
    "total_debt",
    "current_assets",
    "current_liabilities",
    "inventory",
    "cogs",
    "operating_cash_flow",
    "eps",
    "bvps",
    "advances",
    "shares_outstanding",
    "audit_opinion",
)


def bulk_upsert(db: Session, rows: list[dict]) -> int:
    """Upsert quarterly financial rows by (ticker, period). Skip incomplete rows.

    Normalizes each row to the same key set (`ticker`, `period`, plus all `_UPSERT_FIELDS`)
    with `None` for missing fields. SQLAlchemy's bulk INSERT fails on heterogeneous keys
    when a missing column has no Python-side default.
    """
    valid = [r for r in rows if r.get("ticker") and r.get("period") and r.get("year") and r.get("quarter")]
    if not valid:
        return 0

    normalized = [
        {"ticker": r["ticker"], "period": r["period"], **{f: r.get(f) for f in _UPSERT_FIELDS}}
        for r in valid
    ]
    stmt = sqlite_insert(FinancialReport).values(normalized)
    stmt = stmt.on_conflict_do_update(
        index_elements=["ticker", "period"],
        set_={field: getattr(stmt.excluded, field) for field in _UPSERT_FIELDS},
    )
    db.execute(stmt)
    return len(normalized)


def list_latest(db: Session, ticker: str, limit: int = 4) -> list[FinancialReport]:
    """Most recent N quarterly reports, sort year DESC, quarter DESC."""
    stmt = (
        select(FinancialReport)
        .where(FinancialReport.ticker == ticker)
        .order_by(desc(FinancialReport.year), desc(FinancialReport.quarter))
        .limit(limit)
    )
    return list(db.execute(stmt).scalars())


def latest(db: Session, ticker: str) -> FinancialReport | None:
    rows = list_latest(db, ticker, limit=1)
    return rows[0] if rows else None


def count_quarters(db: Session, ticker: str) -> int:
    stmt = select(FinancialReport.id).where(FinancialReport.ticker == ticker)
    return len(list(db.execute(stmt).scalars()))
