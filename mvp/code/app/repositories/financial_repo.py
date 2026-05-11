"""financial_reports access — TAD g03 Table 3."""

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.financial import FinancialReport


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
