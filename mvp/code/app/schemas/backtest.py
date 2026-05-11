"""Backtest schemas — TAD g02 §8.5-8.6 + SRS f12 UC-12-03."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class BacktestStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period_from: date
    period_to: date


class BacktestAcceptedResponse(BaseModel):
    """POST /api/backtest 202."""

    model_config = ConfigDict(extra="forbid")

    backtest_id: int
    status: str  # PENDING | RUNNING | COMPLETED | FAILED


class BacktestStatusResponse(BaseModel):
    """GET /api/backtest/{id}/status — TAD g02 §8.5 polling 1.5s."""

    model_config = ConfigDict(extra="forbid")

    backtest_id: int
    status: str
    started_at: str | None
    completed_at: str | None


class RoiCurvePoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    week: str  # ISO week label e.g. "2026-W18"
    portfolio: float
    vnindex: float


class BacktestMetricsResponse(BaseModel):
    """GET /api/backtest/{id} — TAD g02 §8.6."""

    model_config = ConfigDict(extra="forbid")

    backtest_id: int
    period_from: str
    period_to: str
    status: str  # COMPLETED | FAILED
    recommendation_accuracy: float  # 0..1
    price_error_mean: float  # 0..100 (%)
    portfolio_roi: float  # signed %
    vnindex_roi: float
    alpha: float
    correct_count: int
    total_count: int  # = scored_count latest run
    roi_curve: list[RoiCurvePoint]


class BacktestResultRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ticker: str
    predicted_recommendation: str  # MUA | GIU | BAN
    predicted_price: float  # ngàn đồng
    actual_price: float  # ngàn đồng
    price_error_pct: float
    actual_return_3m: float  # signed %
    recommendation_correct: bool


class BacktestResultsResponse(BaseModel):
    """GET /api/backtest/{id}/results."""

    model_config = ConfigDict(extra="forbid")

    results: list[BacktestResultRow]
