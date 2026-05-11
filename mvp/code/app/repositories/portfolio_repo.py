"""portfolio repository — TAD g03 Table 10."""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.portfolio import PortfolioHolding


def list_all(db: Session) -> tuple[list[PortfolioHolding], int]:
    items = list(db.scalars(select(PortfolioHolding).order_by(desc(PortfolioHolding.created_at))))
    total = db.scalar(select(func.count()).select_from(PortfolioHolding)) or 0
    return items, int(total)


def get(db: Session, holding_id: int) -> PortfolioHolding | None:
    return db.get(PortfolioHolding, holding_id)


def create(
    db: Session,
    *,
    ticker: str,
    quantity: int,
    buy_price: float,
    buy_date: date,
    notes: str | None = None,
) -> PortfolioHolding:
    now = datetime.now(UTC).replace(tzinfo=None)
    row = PortfolioHolding(
        ticker=ticker,
        quantity=quantity,
        buy_price=buy_price,
        buy_date=buy_date,
        notes=notes,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    return row


def update(
    db: Session,
    row: PortfolioHolding,
    *,
    quantity: int | None = None,
    buy_price: float | None = None,
    buy_date: date | None = None,
    notes: str | None = None,
) -> PortfolioHolding:
    if quantity is not None:
        row.quantity = quantity
    if buy_price is not None:
        row.buy_price = buy_price
    if buy_date is not None:
        row.buy_date = buy_date
    if notes is not None:
        row.notes = notes
    row.updated_at = datetime.now(UTC).replace(tzinfo=None)
    return row


def delete(db: Session, row: PortfolioHolding) -> None:
    db.delete(row)
