"""Compare schemas — TAD g02 §8.3 + SRS g03 §Q REC_RANK + §R buckets."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class CompareDelta(BaseModel):
    model_config = ConfigDict(extra="forbid")
    a: float
    b: float
    delta: float  # b - a


class CompareSummaryDiff(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scored: CompareDelta
    buy_count: CompareDelta
    hold_count: CompareDelta
    sell_count: CompareDelta
    avg_score: CompareDelta
    duration_seconds: CompareDelta


class RecommendationChange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    name: str
    rec_a: str  # MUA | GIU | BAN
    rec_b: str
    score_a: float
    score_b: float
    direction: str  # 'upgrade' | 'downgrade'


class CompareEntryRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ticker: str
    name: str
    rec: str
    score: float


class ScoreDistribution(BaseModel):
    model_config = ConfigDict(extra="forbid")
    buckets: list[str]
    a_counts: list[int]
    b_counts: list[int]


class CompareResponse(BaseModel):
    """GET /api/runs/{a}/compare/{b} — TAD g02 §8.3."""

    model_config = ConfigDict(extra="forbid")
    summary_diff: CompareSummaryDiff
    recommendation_changes: list[RecommendationChange]
    new_entries: list[CompareEntryRow]
    removed: list[CompareEntryRow]
    score_distribution: ScoreDistribution
