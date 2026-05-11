"""macro_data access — TAD g03 Table 4."""

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.macro import MacroData


def latest_by_indicator(db: Session, indicator: str) -> MacroData | None:
    stmt = (
        select(MacroData)
        .where(MacroData.indicator == indicator)
        .order_by(desc(MacroData.period))
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def all_latest(db: Session) -> dict[str, float]:
    """Return {indicator: value} for the most recent period of each indicator."""
    out: dict[str, float] = {}
    indicators = db.execute(select(MacroData.indicator).distinct()).scalars().all()
    for ind in indicators:
        row = latest_by_indicator(db, ind)
        if row is not None:
            out[ind] = float(row.value)
    return out
