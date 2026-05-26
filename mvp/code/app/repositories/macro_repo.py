"""macro_data access — TAD g03 Table 4."""

from __future__ import annotations

from datetime import date

from sqlalchemy import desc, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
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


def bulk_upsert(db: Session, rows: list[dict]) -> int:
    valid = [r for r in rows if r.get("indicator") and r.get("period") and r.get("value") is not None]
    if not valid:
        return 0
    stmt = sqlite_insert(MacroData).values(valid)
    stmt = stmt.on_conflict_do_update(
        index_elements=["indicator", "period"],
        set_={
            "value": stmt.excluded.value,
            "source": stmt.excluded.source,
        },
    )
    db.execute(stmt)
    return len(valid)


def _period_date(period: str) -> date | None:
    """Parse supported macro periods: YYYY-MM-DD, YYYY, YYYYQn."""
    if not period:
        return None
    try:
        return date.fromisoformat(period)
    except ValueError:
        pass
    if len(period) == 4 and period.isdigit():
        return date(int(period), 12, 31)
    if len(period) == 6 and period[:4].isdigit() and period[4] == "Q" and period[5].isdigit():
        q = int(period[5])
        month_day = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}.get(q)
        if month_day:
            return date(int(period[:4]), *month_day)
    return None


def value_at_or_before(db: Session, indicator: str, target: date) -> MacroData | None:
    rows = list(
        db.scalars(
            select(MacroData)
            .where(MacroData.indicator == indicator)
            .order_by(desc(MacroData.period))
        )
    )
    candidates = []
    for row in rows:
        parsed = _period_date(row.period)
        if parsed is not None and parsed <= target:
            candidates.append((parsed, row))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


def return_between(db: Session, indicator: str, start: date, end: date) -> float | None:
    start_row = value_at_or_before(db, indicator, start)
    end_row = value_at_or_before(db, indicator, end)
    if start_row is None or end_row is None:
        return None
    start_value = float(start_row.value)
    end_value = float(end_row.value)
    if start_value <= 0:
        return None
    return (end_value - start_value) / start_value * 100.0
