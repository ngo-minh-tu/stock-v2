"""Stock list + Price Board + price history + run selector — TAD g02 §7.1 + SRS f05/f08."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.constants.error_codes import ERR_NOT_FOUND
from app.core.envelope import success
from app.core.errors import AppError
from app.dependencies import CurrentUser, DbSession
from app.services import stock_service

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("")
def get_stocks(
    _user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    return success(stock_service.list_stocks_with_prices(db, limit=limit, offset=offset))


@router.get("/{ticker}")
def get_stock_static(
    _user: CurrentUser,
    db: DbSession,
    ticker: Annotated[str, Path(min_length=1)],
) -> dict:
    out = stock_service.get_stock_static(db, ticker.upper())
    if out is None:
        raise AppError(ERR_NOT_FOUND, f"Mã {ticker} không tồn tại", http_status=404)
    return success(out)


@router.get("/{ticker}/prices")
def get_stock_prices(
    _user: CurrentUser,
    db: DbSession,
    ticker: Annotated[str, Path(min_length=1)],
    interval: Annotated[str, Query(pattern="^[DWM]$")] = "D",
    lookback: Annotated[str, Query()] = "6T",
) -> dict:
    return success(
        stock_service.get_price_history(
            db,
            ticker=ticker.upper(),
            interval=interval,
            lookback=lookback,
        )
    )


@router.get("/{ticker}/runs")
def get_stock_runs(
    _user: CurrentUser,
    db: DbSession,
    ticker: Annotated[str, Path(min_length=1)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    return success(stock_service.list_runs_for_stock(db, ticker.upper(), limit=limit))
