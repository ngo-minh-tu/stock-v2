"""Telegram service — TAD c07 + SRS f14 + TAD g02 §9.4.

Two outbound flows share `_resolve_credentials` + `_post_message`:

1. `send_test_message` — POST /api/telegram/test probe (sync, returns dict).
2. `broadcast_run_summary` — Phase 23: gọi từ screening finalize hook sau khi
   manual run COMPLETED. Non-blocking — Telegram lỗi chỉ tag run với
   `telegram_sent=false` + `telegram_error`, KHÔNG fail run (TAD c07 §1.2).

Settings table priority over env vars (TAD c07 §1.1). Empty 2 nguồn → log
+ return `{sent: false, error: 'Telegram chưa cấu hình ...'}`.

Envelope test endpoint luôn `success: true` (HTTP 200) — `data.sent` flag biểu
thị app-level state.
"""

from __future__ import annotations

import logging
import time

import httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants.enums import Recommendation
from app.repositories import results_repo, screening_repo, settings_repo

log = logging.getLogger(__name__)

_TEST_MESSAGE = "🧪 VN RE Screener — tin thử kết nối Telegram OK."
_TIMEOUT_S = 5.0

# Phase 28 — Telegram Bot API rate-limit: 30 msg/sec per chat, but server có thể
# trả 429 + `Retry-After` header (seconds). 1 retry là đủ cho MVP single-user
# single-run: collision rất hiếm (broadcast 1 lần/run). KHÔNG retry vô hạn để
# tránh giữ session BG task. Cap delay 30s — Bot API hiếm trả > 30.
_RATE_LIMIT_MAX_RETRIES = 1
_RATE_LIMIT_MAX_WAIT_S = 30.0
_RATE_LIMIT_DEFAULT_WAIT_S = 5.0


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


def _extract_retry_after_seconds(response: httpx.Response) -> float:
    """Phase 28 — parse `Retry-After` header hoặc JSON `parameters.retry_after`.

    Telegram Bot API on 429 returns:
      {"ok": false, "error_code": 429, "description": "Too Many Requests: ...",
       "parameters": {"retry_after": 5}}
    HTTP standard `Retry-After` header is also possible (seconds integer).
    Fallback `_RATE_LIMIT_DEFAULT_WAIT_S` nếu không parse được. Cap tới max.
    """
    header_val = response.headers.get("retry-after")
    if header_val:
        try:
            return min(float(header_val), _RATE_LIMIT_MAX_WAIT_S)
        except ValueError:
            pass
    try:
        body = response.json()
        retry_after = body.get("parameters", {}).get("retry_after")
        if retry_after is not None:
            return min(float(retry_after), _RATE_LIMIT_MAX_WAIT_S)
    except Exception:  # noqa: BLE001
        pass
    return _RATE_LIMIT_DEFAULT_WAIT_S


def _post_message(*, chat_id: str, token: str, text: str) -> dict:
    """Low-level Bot API sendMessage. Returns `{sent, error}` envelope-style dict.

    `disable_notification=True` to avoid waking the operator at 4am on every
    scheduled refresh; broadcast already implies an interesting event (run
    completed), but the chat is silent-tagged.

    Phase 28 — single retry on 429 rate-limit. Honors `Retry-After` header
    hoặc `parameters.retry_after` JSON field. Cap wait `_RATE_LIMIT_MAX_WAIT_S`
    (30s) để không hold BG task. Failure path (no retry): 401 invalid token,
    400 chat_not_found, 5xx server error — return error trực tiếp.
    """
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    attempts = _RATE_LIMIT_MAX_RETRIES + 1  # initial + retries
    for attempt in range(attempts):
        try:
            r = httpx.post(
                url,
                json={"chat_id": chat_id, "text": text, "disable_notification": True},
                timeout=_TIMEOUT_S,
            )
        except httpx.TimeoutException:
            return {"sent": False, "error": "Telegram API timeout"}
        except httpx.HTTPError as exc:
            # SCRUB: httpx exception str typically includes the request URL, which
            # would leak the bot token. Log class only — return user-facing message
            # also avoids token leak.
            log.warning("telegram HTTPError: %s", exc.__class__.__name__)
            return {"sent": False, "error": f"Telegram API lỗi: {exc.__class__.__name__}"}

        if r.status_code == 200:
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            if body.get("ok"):
                return {"sent": True, "error": None}
            return {"sent": False, "error": body.get("description") or "Telegram trả ok=false"}

        if r.status_code == 429 and attempt < attempts - 1:
            wait_s = _extract_retry_after_seconds(r)
            log.info("telegram 429 rate-limit; retry sau %.1fs", wait_s)
            time.sleep(wait_s)
            continue

        # 401 invalid token, 400 chat_not_found, 5xx server error, hoặc 429 sau retry
        try:
            body = r.json()
            desc = body.get("description") or f"HTTP {r.status_code}"
        except Exception:  # noqa: BLE001
            desc = f"HTTP {r.status_code}"
        return {"sent": False, "error": desc}

    # Unreachable — loop always returns or breaks. Defensive only.
    return {"sent": False, "error": "Telegram API: retry exhausted"}


def send_test_message(db: Session) -> dict:
    chat_id, token = _resolve_credentials(db)
    if not chat_id or not token:
        return {"sent": False, "error": "Telegram chưa cấu hình (chat_id hoặc token rỗng)"}
    return _post_message(chat_id=chat_id, token=token, text=_TEST_MESSAGE)


# ---------------------------------------------------------------------------
# Phase 23 — Run summary broadcast (SRS f14 UC-14-01 + TAD c07 §1)
# ---------------------------------------------------------------------------

def _build_run_summary_message(
    *, run, top_rows, warning_count: int, app_url: str
) -> str:
    """Compose the multi-line text per f14 UC-14-01 Message Template.

    Top rows must be pre-sorted by `ai_score` DESC, already truncated to
    `telegram_top_n`. `run.run_at` formatted as `YYYY-MM-DD HH:MM` (UTC).
    """
    run_date = run.run_at.strftime("%Y-%m-%d %H:%M") if run.run_at else ""
    buy = run.buy_count or 0
    hold = run.hold_count or 0
    sell = run.sell_count or 0
    top_n = len(top_rows)

    lines: list[str] = []
    lines.append(f"🔍 VN RE AI Screener — Run {run_date}".rstrip())
    lines.append("")
    lines.append(f"📊 Kết quả: {buy} MUA | {hold} GIỮ | {sell} BÁN")
    lines.append("")
    lines.append(f"🏆 Top {top_n} MUA:")
    for i, r in enumerate(top_rows, start=1):
        score = int(round(float(r.ai_score or 0)))
        upside = float(r.upside_pct or 0)
        signal = r.entry_signal or "—"
        # f14 template uses ▲ + percent; format upside with one decimal place
        # but strip trailing zeros for readability (e.g. ▲12% not ▲12.0%).
        upside_txt = f"{upside:.1f}".rstrip("0").rstrip(".")
        lines.append(
            f"{i}. {r.ticker} — Score {score} — ▲{upside_txt}% — {signal}"
        )
    lines.append("")
    lines.append(f"⚠️ Cảnh báo: {warning_count} mã có risk flags")
    lines.append("")
    lines.append(f"⚡ Xem chi tiết: {app_url}")
    return "\n".join(lines)


def _count_warnings(rows) -> int:
    """Số mã có warning_badges_json không rỗng (JSON array length > 0)."""
    import json as _json
    n = 0
    for r in rows:
        raw = r.warning_badges_json or "[]"
        try:
            arr = _json.loads(raw)
        except (ValueError, TypeError):
            arr = []
        if isinstance(arr, list) and len(arr) > 0:
            n += 1
    return n


def broadcast_run_summary(db: Session, run_id: str) -> dict:
    """Send Telegram summary cho 1 run đã COMPLETED. Non-blocking.

    Returns dict `{sent, error, skipped}`:
    - `skipped=True` khi `telegram_enabled=false` hoặc credentials rỗng — KHÔNG
      treat as error (AC-14-01: enabled=false → no send, no error).
    - `sent=True, error=None` khi Bot API trả ok=true.
    - `sent=False, error=<msg>` khi gửi thất bại (AC-14-03: log + non-blocking).

    Caller (`screening_service`) chịu trách nhiệm persist `telegram_sent` +
    `telegram_error` vào `screening_runs`. Service này KHÔNG self-commit để
    caller giữ control transaction.
    """
    run = screening_repo.get(db, run_id)
    if run is None:
        log.warning("broadcast_run_summary: run %s not found", run_id)
        return {"sent": False, "error": "Run không tồn tại", "skipped": True}

    s = settings_repo.get_settings_row(db)
    if not s.telegram_enabled:
        return {"sent": False, "error": None, "skipped": True}

    chat_id, token = _resolve_credentials(db)
    if not chat_id or not token:
        # AC-14-01 hybrid: enabled=true nhưng creds rỗng = misconfig — non-fatal,
        # tag error to surface trong run record + UI badge.
        return {
            "sent": False,
            "error": "Telegram chưa cấu hình (chat_id hoặc token rỗng)",
            "skipped": False,
        }

    top_n = int(s.telegram_top_n or 3)
    rows = results_repo.list_by_run(db, run_id)
    buy_rows = [r for r in rows if r.recommendation == Recommendation.MUA.value]
    buy_rows.sort(key=lambda r: float(r.ai_score or 0), reverse=True)
    top_rows = buy_rows[:top_n]

    warning_count = _count_warnings(rows)
    cfg = get_settings()
    text = _build_run_summary_message(
        run=run,
        top_rows=top_rows,
        warning_count=warning_count,
        app_url=cfg.frontend_origin.rstrip("/"),
    )

    result = _post_message(chat_id=chat_id, token=token, text=text)
    result["skipped"] = False
    if result["sent"]:
        log.info("[%s] telegram broadcast sent (top_n=%d)", run_id, top_n)
    else:
        log.warning("[%s] telegram broadcast failed: %s", run_id, result["error"])
    return result


__all__ = ["send_test_message", "broadcast_run_summary"]
