"""Share Link schemas — TAD g02 §9.2 + SRS f13 UC-13-02."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class ShareCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str
    expires_in_days: Annotated[int, Field(ge=1, le=365)] = 7


class ShareLinkItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    run_id: str
    url: str  # relative path "/share/{token}" — frontend prepend origin runtime
    created_at: str  # ISO
    expires_at: str  # ISO


class ShareCreateResponse(ShareLinkItem):
    """POST /api/share 201 — same shape as list item."""


class ShareListResponse(BaseModel):
    """GET /api/share — list active (non-expired) sort newest first."""

    model_config = ConfigDict(extra="forbid")

    items: list[ShareLinkItem]


class SharedViewResponse(BaseModel):
    """GET /api/share/{token} (PUBLIC) — TAD g02 §9.2."""

    model_config = ConfigDict(extra="forbid")

    token: str
    run_id: str
    expires_at: str
    data: dict  # {summary, dashboard, top_mua}


class ShareDeleteResponse(BaseModel):
    """DELETE /api/share/{token} — 200 + envelope (TAD §8.1)."""

    model_config = ConfigDict(extra="forbid")

    token: str
    deleted: bool
