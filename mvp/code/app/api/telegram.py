"""Telegram endpoint — TAD g02 §9.4 + SRS f14 UC-14-02 (test send).

POST /api/telegram/test → 200 {sent, error} envelope. App-level error trong `data.sent=false`,
không phải HTTP 500.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.envelope import success
from app.dependencies import CurrentUser, DbSession
from app.services import telegram_service

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/test")
def telegram_test(db: DbSession, _user: CurrentUser) -> dict:
    return success(telegram_service.send_test_message(db))
