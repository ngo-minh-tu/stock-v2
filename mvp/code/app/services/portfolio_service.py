"""Portfolio service — CRUD + validateHolding mirror.

SRS f11 UC-11-01 AC-11-02..06 + TAD g02 §8.2 server-side validation:
1. ticker phải trong whitelist (stocks table) → ERR-11-04
2. quantity phải là số nguyên dương → ERR-11-02
3. buy_price phải là số dương → ERR-11-03
4. buy_date format YYYY-MM-DD → ERR-11-05 (Pydantic catch hầu hết, mirror cho parity)
5. buy_date ≤ TODAY (UTC) → ERR-11-06

Backend dùng `date.today()` real per SRS g03 §S note "Backend phase: thay
MOCK_FIXTURE_TODAY bằng datetime.now(UTC) thực".
"""

from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.constants.error_codes import (
    ERR_NOT_FOUND,
    ERR_PORTFOLIO_DATE_FUTURE,
    ERR_PORTFOLIO_DATE_INVALID,
    ERR_PORTFOLIO_PRICE_INVALID,
    ERR_PORTFOLIO_QUANTITY_INVALID,
    ERR_PORTFOLIO_TICKER_INVALID,
)
from app.core.errors import AppError
from app.models import Stock
from app.models.portfolio import PortfolioHolding
from app.repositories import portfolio_repo


def _today_utc() -> date:
    return datetime.now(UTC).date()


def _ensure_ticker_whitelisted(db: Session, ticker: str) -> str:
    """Normalize ticker uppercase + verify in stocks table (status agnostic — we
    accept any seeded ticker). Raise ERR-11-04 if missing.
    """
    norm = (ticker or "").strip().upper()
    if not norm:
        raise AppError(
            ERR_PORTFOLIO_TICKER_INVALID,
            "Mã không hợp lệ",
            http_status=400,
        )
    if db.get(Stock, norm) is None:
        raise AppError(
            ERR_PORTFOLIO_TICKER_INVALID,
            f"Mã {norm} không có trong whitelist",
            http_status=400,
        )
    return norm


def _ensure_quantity(quantity) -> int:
    if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
        raise AppError(
            ERR_PORTFOLIO_QUANTITY_INVALID,
            "Số lượng phải là số nguyên dương",
            http_status=400,
        )
    return quantity


def _ensure_price(buy_price) -> float:
    try:
        v = float(buy_price)
    except (TypeError, ValueError) as e:
        raise AppError(
            ERR_PORTFOLIO_PRICE_INVALID,
            "Giá mua phải là số dương",
            http_status=400,
        ) from e
    if v != v or v <= 0:  # NaN check via self-inequality
        raise AppError(
            ERR_PORTFOLIO_PRICE_INVALID,
            "Giá mua phải là số dương",
            http_status=400,
        )
    return v


def _ensure_buy_date(buy_date: date | None) -> date:
    if not isinstance(buy_date, date):
        raise AppError(
            ERR_PORTFOLIO_DATE_INVALID,
            "Ngày mua không hợp lệ",
            http_status=400,
        )
    if buy_date > _today_utc():
        raise AppError(
            ERR_PORTFOLIO_DATE_FUTURE,
            "Ngày mua không thể ở tương lai",
            http_status=400,
        )
    return buy_date


def list_holdings(db: Session) -> tuple[list[PortfolioHolding], int]:
    return portfolio_repo.list_all(db)


def create_holding(
    db: Session,
    *,
    ticker: str,
    quantity: int,
    buy_price: float,
    buy_date: date,
    notes: str | None = None,
) -> PortfolioHolding:
    ticker_n = _ensure_ticker_whitelisted(db, ticker)
    qty = _ensure_quantity(quantity)
    price = _ensure_price(buy_price)
    bd = _ensure_buy_date(buy_date)
    return portfolio_repo.create(
        db,
        ticker=ticker_n,
        quantity=qty,
        buy_price=price,
        buy_date=bd,
        notes=notes,
    )


def update_holding(
    db: Session,
    holding_id: int,
    *,
    quantity: int | None = None,
    buy_price: float | None = None,
    buy_date: date | None = None,
    notes: str | None = None,
) -> PortfolioHolding:
    row = portfolio_repo.get(db, holding_id)
    if row is None:
        raise AppError(ERR_NOT_FOUND, "Holding không tồn tại", http_status=404)
    if quantity is not None:
        quantity = _ensure_quantity(quantity)
    if buy_price is not None:
        buy_price = _ensure_price(buy_price)
    if buy_date is not None:
        buy_date = _ensure_buy_date(buy_date)
    return portfolio_repo.update(
        db,
        row,
        quantity=quantity,
        buy_price=buy_price,
        buy_date=buy_date,
        notes=notes,
    )


def delete_holding(db: Session, holding_id: int) -> int:
    row = portfolio_repo.get(db, holding_id)
    if row is None:
        raise AppError(ERR_NOT_FOUND, "Holding không tồn tại", http_status=404)
    portfolio_repo.delete(db, row)
    return holding_id
