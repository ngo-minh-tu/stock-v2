"""Portfolio endpoints — TAD g02 §1 + §8.2 + SRS f11.

GET    /api/portfolio        → 200 {items, total}
POST   /api/portfolio        → 201 {holding}
PUT    /api/portfolio/{id}   → 200 {holding}
DELETE /api/portfolio/{id}   → 200 + envelope {id, deleted} (TAD g02 §8.1)
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, status

from app.core.envelope import success
from app.dependencies import CurrentUser, DbSession
from app.schemas.portfolio import (
    PortfolioCreateRequest,
    PortfolioHoldingResponse,
    PortfolioUpdateRequest,
)
from app.services import portfolio_service

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _serialize(row) -> dict:
    return PortfolioHoldingResponse.model_validate(row).model_dump(mode="json")


@router.get("")
def list_portfolio(_user: CurrentUser, db: DbSession) -> dict:
    items, total = portfolio_service.list_holdings(db)
    return success({"items": [_serialize(r) for r in items], "total": total})


@router.post("", status_code=status.HTTP_201_CREATED)
def create_portfolio(
    body: PortfolioCreateRequest,
    db: DbSession,
    _user: CurrentUser,
) -> dict:
    row = portfolio_service.create_holding(
        db,
        ticker=body.ticker,
        quantity=body.quantity,
        buy_price=body.buy_price,
        buy_date=body.buy_date,
        notes=body.notes,
    )
    db.commit()
    db.refresh(row)
    return success(_serialize(row))


@router.put("/{holding_id}")
def update_portfolio(
    body: PortfolioUpdateRequest,
    db: DbSession,
    _user: CurrentUser,
    holding_id: Annotated[int, Path(ge=1)],
) -> dict:
    row = portfolio_service.update_holding(
        db,
        holding_id,
        quantity=body.quantity,
        buy_price=body.buy_price,
        buy_date=body.buy_date,
        notes=body.notes,
    )
    db.commit()
    db.refresh(row)
    return success(_serialize(row))


@router.delete("/{holding_id}")
def delete_portfolio(
    db: DbSession,
    _user: CurrentUser,
    holding_id: Annotated[int, Path(ge=1)],
) -> dict:
    deleted_id = portfolio_service.delete_holding(db, holding_id)
    db.commit()
    return success({"id": deleted_id, "deleted": True})
