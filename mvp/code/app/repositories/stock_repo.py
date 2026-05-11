"""Stock whitelist repository."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Stock


def list_active_tickers(db: Session) -> list[str]:
    return list(db.scalars(select(Stock.ticker).where(Stock.status == "ACTIVE")))


def list_all_stocks(db: Session) -> list[Stock]:
    return list(db.scalars(select(Stock).order_by(Stock.ticker)))
