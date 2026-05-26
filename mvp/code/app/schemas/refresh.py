"""Refresh schemas — TAD g02 §1."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RefreshPricesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resume_failed: bool = False
    tickers: list[str] | None = Field(default=None, max_length=200)


class RefreshAcceptedResponse(BaseModel):
    """POST /refresh/* trả 202 Accepted."""

    refresh_id: str
    status: str


class RefreshStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_id: str
    type: str  # "refresh" hoặc "screening" (job_lock cùng registry)
    status: str
    progress: int
    message: str
    started_at: str
    finished_at: str | None
    error: str | None
    stats: dict
