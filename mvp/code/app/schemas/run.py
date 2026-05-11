"""Run / screening schemas — TAD g02 §1 + §8.4 RunSummary expanded."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RunRequest(BaseModel):
    """POST /api/run body — SRS f01 UC-01-01 input."""

    model_config = ConfigDict(extra="ignore")  # FE prototype gửi `outcome` mock — bỏ qua

    total_capital: float = Field(default=0, ge=0, description="VNĐ raw đồng, ≥ 0")
    skip_allocation: bool = Field(
        default=False,
        description="True → bỏ qua allocation (UI checkbox)",
    )


class RunAcceptedResponse(BaseModel):
    """POST /api/run trả 202."""

    run_id: str
    status: str


class RunStatusResponse(BaseModel):
    """GET /api/runs/{run_id}/status — TAD g01 §2.2 polling shape."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    status: str  # RunStatus enum value
    progress_percent: int
    current_step: str | None
    started_at: str  # ISO
    completed_at: str | None
    duration_seconds: float | None  # live cho active, recalc khi terminal (TAD g02 §8.4)
    run_error: str | None


class RunSummary(BaseModel):
    """Compact summary shape — RunSelector + Run History list (TAD g02 §8.4 cluster 5).

    All 12 fields: cluster 2 (7) + cluster 5 additive (5).
    """

    model_config = ConfigDict(extra="forbid")

    # cluster 2 fields (existing)
    run_id: str
    run_at: str  # ISO
    status: str
    scored_count: int
    buy_count: int
    hold_count: int
    sell_count: int
    # cluster 5 new fields (additive)
    model_version: str
    settings_version: int
    duration_seconds: float
    warnings_count: int
    avg_score: float


class RunListResponse(BaseModel):
    """GET /api/runs paginated."""

    model_config = ConfigDict(extra="forbid")

    items: list[RunSummary]
    total: int
    limit: int
    offset: int


class RunDeletedResponse(BaseModel):
    """DELETE /api/runs/{run_id} — 200 + envelope (TAD g02 §8.1)."""

    run_id: str
    deleted: bool


class ScreeningResultRow(BaseModel):
    """Tóm tắt 1 row screening_results — dùng cho /runs/{id} detail.

    Wire output Phase 6+ sẽ chi tiết hơn (radar, features, reasons[]).
    """

    model_config = ConfigDict(extra="forbid")

    ticker: str
    ai_score: float
    recommendation: str
    confidence_raw: float
    confidence_penalty: int
    confidence: float
    target_price_3m: float
    current_price: float
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
    reasons: list[dict[str, Any]]


class RunFullSummary(BaseModel):
    """GET /api/runs/{run_id} — full metadata + counts (KHÔNG include results[] — dùng /results)."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    run_at: str
    status: str
    model_version: str
    settings_version: int
    total_capital: float
    data_from_cache: bool
    total_input: int
    after_round_1: int
    after_round_2: int
    after_round_3: int
    after_round_4: int
    scored_count: int
    buy_count: int
    hold_count: int
    sell_count: int
    duration_seconds: float | None
    warnings: list[str]
    run_error: str | None
