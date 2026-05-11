"""Telegram service — TAD c07 + SRS f14 + TAD g02 §9.4.

POST /api/telegram/test sends a probe message qua Bot API:
- Read `telegram_chat_id` + `telegram_token` từ settings table (priority).
- Fallback to env vars `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` nếu settings rỗng.
- Empty cả 2 nguồn → return `{sent: false, error: 'Telegram chưa cấu hình'}`.

Envelope luôn `success: true` (HTTP 200) — `data.sent` flag biểu thị app-level state.
Error trong telegram KHÔNG block UX.
"""

from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.repositories import settings_repo

log = logging.getLogger(__name__)

_TEST_MESSAGE = "🧪 VN RE Screener — tin thử kết nối Telegram OK."
_TIMEOUT_S = 5.0


def _resolve_credentials(db: Session) -> tuple[str, str]:
    """(chat_id, token) — empty strings nếu chưa configure."""
    s = settings_repo.get_settings_row(db)
    chat_id = (s.telegram_chat_id or "").strip()
    token = (s.telegram_token or "").strip()
    if not chat_id or not token:
        cfg = get_settings()
        chat_id = chat_id or cfg.telegram_chat_id.strip()
        token = token or cfg.telegram_bot_token.strip()
    return chat_id, token


def send_test_message(db: Session) -> dict:
    chat_id, token = _resolve_credentials(db)
    if not chat_id or not token:
        return {"sent": False, "error": "Telegram chưa cấu hình (chat_id hoặc token rỗng)"}

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        r = httpx.post(
            url,
            json={"chat_id": chat_id, "text": _TEST_MESSAGE, "disable_notification": True},
            timeout=_TIMEOUT_S,
        )
    except httpx.TimeoutException:
        return {"sent": False, "error": "Telegram API timeout"}
    except httpx.HTTPError as exc:
        log.warning("telegram test HTTPError: %s", exc)
        return {"sent": False, "error": f"Telegram API lỗi: {exc.__class__.__name__}"}

    if r.status_code == 200:
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if body.get("ok"):
            return {"sent": True, "error": None}
        return {"sent": False, "error": body.get("description") or "Telegram trả ok=false"}

    # 401 invalid token, 400 chat_not_found, 429 rate-limit, 5xx server error
    try:
        body = r.json()
        desc = body.get("description") or f"HTTP {r.status_code}"
    except Exception:  # noqa: BLE001
        desc = f"HTTP {r.status_code}"
    return {"sent": False, "error": desc}
