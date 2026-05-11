"""Telegram schemas — TAD g02 §9.4 + SRS f14."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class TelegramTestResponse(BaseModel):
    """POST /api/telegram/test — envelope success=true even when sent=false (TAD §9.4)."""

    model_config = ConfigDict(extra="forbid")

    sent: bool
    error: str | None
