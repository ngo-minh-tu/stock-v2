"""Stock + Price Board schemas — TAD g02 §7.1."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class LatestPrice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    open: float  # ngàn đồng
    high: float
    low: float
    close: float  # current_price
    reference: float
    ceiling: float
    floor: float
    change: float  # signed (= close - reference)
    change_pct: float  # signed % vs reference
    volume: int  # raw shares
    as_of: str  # ISO 8601


class StockListItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    name: str
    exchange: str  # HOSE | HNX | UPCOM
    sector: str | None
    newly_listed: bool
    latest: LatestPrice | None  # null nếu chưa có price data


class StockListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[StockListItem]
    total: int
    limit: int
    offset: int


class StockStaticInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    name: str
    exchange: str
    sector: str | None
    newly_listed: bool
    status: str
    latest: LatestPrice | None


class PriceBar(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str  # YYYY-MM-DD
    open: float  # ngàn đồng
    high: float
    low: float
    close: float
    volume: int


class PriceHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    interval: str  # D | W | M
    lookback: str
    bars: list[PriceBar]


class StockRunListItem(BaseModel):
    """Run nào đã chấm mã này — cho Stock Detail run selector dropdown."""

    model_config = ConfigDict(extra="forbid")
    run_id: str
    run_at: str
    status: str
    ai_score: float
    recommendation: str


class StockRunsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    items: list[StockRunListItem]
    total: int
