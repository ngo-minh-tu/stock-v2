"""Stock price repository — bulk upsert OHLCV rows."""

from __future__ import annotations

from datetime import date

from sqlalchemy import desc, func, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models import StockPrice


def bulk_upsert(db: Session, rows: list[dict]) -> int:
    """Upsert OHLCV rows by (ticker, date) unique index. Skip rows thiếu ticker/date.

    Return số rows được insert/update (= số rows hợp lệ).
    """
    valid = [r for r in rows if r.get("ticker") and r.get("date")]
    if not valid:
        return 0

    stmt = sqlite_insert(StockPrice).values(valid)
    stmt = stmt.on_conflict_do_update(
        index_elements=["ticker", "date"],
        set_={
            "open": stmt.excluded.open,
            "high": stmt.excluded.high,
            "low": stmt.excluded.low,
            "close": stmt.excluded.close,
            "volume": stmt.excluded.volume,
        },
    )
    db.execute(stmt)
    return len(valid)


def list_recent(db: Session, ticker: str, limit: int = 200) -> list[StockPrice]:
    """Most recent N daily bars cho 1 ticker, oldest → newest sau khi reverse."""
    stmt = (
        select(StockPrice)
        .where(StockPrice.ticker == ticker)
        .order_by(desc(StockPrice.date))
        .limit(limit)
    )
    rows = list(db.execute(stmt).scalars())
    rows.reverse()
    return rows


def list_between(db: Session, ticker: str, start: date, end: date) -> list[StockPrice]:
    stmt = (
        select(StockPrice)
        .where(StockPrice.ticker == ticker)
        .where(StockPrice.date >= start)
        .where(StockPrice.date <= end)
        .order_by(StockPrice.date)
    )
    return list(db.execute(stmt).scalars())


def latest_per_ticker(db: Session) -> dict[str, StockPrice]:
    """Return {ticker: most-recent StockPrice}. Single query với MAX(date) per ticker.

    Dùng cho Price Board GET /api/stocks (single fetch ≤200 mã).
    """
    sub = (
        select(StockPrice.ticker, func.max(StockPrice.date).label("max_date"))
        .group_by(StockPrice.ticker)
        .subquery()
    )
    stmt = (
        select(StockPrice)
        .join(sub, (StockPrice.ticker == sub.c.ticker) & (StockPrice.date == sub.c.max_date))
    )
    out: dict[str, StockPrice] = {}
    for row in db.scalars(stmt):
        out[row.ticker] = row
    return out


def latest(db: Session, ticker: str) -> StockPrice | None:
    stmt = (
        select(StockPrice)
        .where(StockPrice.ticker == ticker)
        .order_by(desc(StockPrice.date))
        .limit(1)
    )
    return db.scalar(stmt)
