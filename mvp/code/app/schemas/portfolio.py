"""Portfolio schemas — TAD g02 §8.2 + SRS f11.

Backend trả raw `PortfolioHolding` rows (KHÔNG compute current_price/cost_basis/
market_value/unrealized_pnl). Frontend join với `/api/stocks` snapshot trong
`useMemo` để build HoldingRow per TAD g02 §8.2.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class PortfolioHoldingResponse(BaseModel):
    """1 row trong /api/portfolio response — TAD g02 §8.2."""

    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: int
    ticker: str
    quantity: int
    buy_price: float  # ngàn đồng (TAD g02 §M)
    buy_date: date  # YYYY-MM-DD
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class PortfolioListResponse(BaseModel):
    """GET /api/portfolio — TAD g02 §8.2."""

    model_config = ConfigDict(extra="forbid")

    items: list[PortfolioHoldingResponse]
    total: int


class PortfolioCreateRequest(BaseModel):
    """POST /api/portfolio body — SRS f11 UC-11-01.

    Pydantic chỉ đảm bảo field types/coercion. Business validation
    (whitelist + buy_date ≤ TODAY) chạy trong portfolio_service.validate_holding
    để return đúng ERR-11-* code thay vì 422 generic.
    """

    model_config = ConfigDict(extra="forbid")

    ticker: Annotated[str, Field(min_length=1, max_length=10)]
    quantity: int
    buy_price: float
    buy_date: date
    notes: str | None = None


class PortfolioUpdateRequest(BaseModel):
    """PUT /api/portfolio/{id} — không cho đổi ticker (SRS f11 UC-11-02 edit mode)."""

    model_config = ConfigDict(extra="forbid")

    quantity: int | None = None
    buy_price: float | None = None
    buy_date: date | None = None
    notes: str | None = None


class PortfolioDeleteResponse(BaseModel):
    """DELETE /api/portfolio/{id} — 200 + envelope (TAD g02 §8.1)."""

    model_config = ConfigDict(extra="forbid")

    id: int
    deleted: bool
