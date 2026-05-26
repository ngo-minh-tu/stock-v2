"""financial_reports access — TAD g03 Table 3."""

from __future__ import annotations

from sqlalchemy import desc, func, select
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

# `year` + `quarter` always come together and are non-null on every upsert row
# (the validator below enforces that). Everything else may be sparse — the fallback
# source might fill in a single missing column, so we don't want a sparser row
# to wipe out a richer one. Phase 21 — Codex Phase 17/18 finding.
_NO_DOWNGRADE_FIELDS = tuple(f for f in _UPSERT_FIELDS if f not in ("year", "quarter"))


def bulk_upsert(db: Session, rows: list[dict]) -> int:
    """Upsert quarterly financial rows by (ticker, period). Skip incomplete rows.

    Phase 21 changes:
    - **No-downgrade upsert**: when a new row carries `None` for a field, keep the
      existing DB value (`COALESCE(excluded.field, FinancialReport.field)`). The
      fallback source (KBS) often returns sparse rows; without this guard a sparse
      KBS upsert could overwrite a richer VCI row for the same `(ticker, period)`.
    - Year/quarter still hard-overwrite (they index the period and are always present
      on every row we accept).
    """
    valid = [
        r for r in rows
        if r.get("ticker") and r.get("period") and r.get("year") and r.get("quarter")
    ]
    if not valid:
        return 0

    normalized = [
        {"ticker": r["ticker"], "period": r["period"], **{f: r.get(f) for f in _UPSERT_FIELDS}}
        for r in valid
    ]
    stmt = sqlite_insert(FinancialReport).values(normalized)
    set_map: dict = {"year": stmt.excluded.year, "quarter": stmt.excluded.quarter}
    for field in _NO_DOWNGRADE_FIELDS:
        set_map[field] = func.coalesce(
            getattr(stmt.excluded, field),
            getattr(FinancialReport, field),
        )
    stmt = stmt.on_conflict_do_update(index_elements=["ticker", "period"], set_=set_map)
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
