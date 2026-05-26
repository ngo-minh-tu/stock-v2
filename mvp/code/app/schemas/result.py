"""Result + Stock Detail + Dashboard + Compare schemas — TAD g02 §4 + §8.3."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Stock Detail (TAD g02 §4)
# ---------------------------------------------------------------------------

class StockStaticSection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    exchange: str
    sector: str | None
    name: str
    current_price: float  # ngàn đồng


class ScoringSection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ai_score: float
    recommendation: str  # MUA | GIU | BAN
    confidence_raw: float
    confidence_penalty: int
    confidence: float
    target_price_3m: float  # ngàn đồng
    upside_pct: float
    radar_industry_avg: dict[str, float] | None = None  # cluster 3 overlay; null cho MVP


class EntrySection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    signal: str
    reason_code: str
    support_zone: float  # ngàn đồng
    resistance_zone: float  # ngàn đồng
    raw_indicators_used: list[str] = Field(default_factory=list)


class RiskSection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stop_loss_price: float  # ngàn đồng
    allocation_amount: float | None  # đồng raw
    allocation_weight: float | None
    warning_badges: list[str]


class StockDetailResponse(BaseModel):
    """GET /api/runs/{run_id}/stocks/{ticker} — TAD g02 §4."""

    model_config = ConfigDict(extra="forbid")
    ticker: str
    name: str
    run_id: str
    static: StockStaticSection
    scoring: ScoringSection
    entry: EntrySection
    risk: RiskSection
    reasons: list[dict[str, Any]] = Field(default_factory=list)
    features: dict[str, float] = Field(default_factory=dict)
    feature_availability: int
    radar: dict[str, float] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Results list (cluster 2 / 6)
# ---------------------------------------------------------------------------

class ResultRow(BaseModel):
    """Compact row cho /runs/{id}/results — đủ cho Top MUA + Dashboard table."""

    model_config = ConfigDict(extra="forbid")
    ticker: str
    name: str
    sector: str | None
    exchange: str
    current_price: float  # ngàn đồng
    market_cap: float | None  # tỷ đồng (computed nếu có shares_outstanding)
    ai_score: float
    recommendation: str
    confidence_raw: float
    confidence_penalty: int
    confidence: float
    target_price_3m: float  # ngàn đồng
    upside_pct: float
    entry_signal: str
    entry_reason_code: str
    support_zone: float
    resistance_zone: float
    stop_loss_price: float
    allocation_amount: float | None
    allocation_weight: float | None
    warning_badges: list[str]
    feature_availability: int
    radar: dict[str, float]


class ResultsListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    results: list[ResultRow]
    total: int


# ---------------------------------------------------------------------------
# Excluded (cluster 2 / red flags)
# ---------------------------------------------------------------------------

class ExcludedItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    name: str
    excluded_round: int
    reason: str
    reason_code: str


class ExcludedListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[ExcludedItem]
    total: int


# ---------------------------------------------------------------------------
# Dashboard (SRS f04 + cluster 2)
# ---------------------------------------------------------------------------

class TreemapCell(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    name: str
    market_cap: float  # tỷ đồng
    recommendation: str
    ai_score: float
    sector: str | None


class TopByScore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    ai_score: float
    recommendation: str


class IndexTrendPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str  # ISO yyyy-mm-dd (week-aligned)
    vnindex: float
    sector: float


class TopUpsideRef(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    upside_pct: float


class DashboardKpi(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scored_count: int
    buy_count: int
    hold_count: int
    sell_count: int
    avg_buy_score: float
    top_upside: TopUpsideRef | None
    alpha_vs_vnindex_pct: float  # avg upside MUA - VN-Index 3M proxy


class PieSlice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recommendation: str
    count: int


class DashboardLineSeries(BaseModel):
    model_config = ConfigDict(extra="forbid")
    points: list[IndexTrendPoint]


class DashboardResponse(BaseModel):
    """GET /api/runs/{run_id}/dashboard — SRS f04 + Cluster 2 layout.

    Field names align with the FE `DashboardResponse` type so apiFetch can
    surface the payload directly (no adapter layer).
    """

    model_config = ConfigDict(extra="forbid")
    run_id: str
    run_at: str
    kpi: DashboardKpi
    treemap: list[TreemapCell]
    pie: list[PieSlice]
    radar: dict[str, float]  # 5 group means
    line: DashboardLineSeries  # 26 weekly points
    bar: list[TopByScore]  # top 10
