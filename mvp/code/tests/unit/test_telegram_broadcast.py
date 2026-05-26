"""Phase 23 — `broadcast_run_summary` unit coverage (SRS f14 UC-14-01 + TAD c07 §1).

Cover all 5 outcome paths:

1. Run không tồn tại → skipped + error message.
2. `telegram_enabled=false` → skipped, KHÔNG gọi httpx (AC-14-01).
3. enabled=true + creds rỗng → not skipped, sent=False, misconfig error.
4. Bot API trả ok=true → sent=True, message text khớp f14 template.
5. Bot API timeout/HTTP error → sent=False, error populated, KHÔNG raise.

Tests dùng mock httpx.post — KHÔNG touch real Bot API. DB state mock qua
fake `screening_repo.get` + `results_repo.list_by_run` + `settings_repo`.
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from app.constants.enums import Recommendation


@pytest.fixture
def mock_db():
    """Sentinel — service code chỉ pass through, không gọi method thật."""
    return object()


def _row(ticker: str, *, score: float, upside: float, signal: str, warnings: str = "[]") -> SimpleNamespace:
    return SimpleNamespace(
        ticker=ticker,
        ai_score=score,
        upside_pct=upside,
        entry_signal=signal,
        recommendation=Recommendation.MUA.value,
        warning_badges_json=warnings,
    )


def _settings(*, enabled: bool, chat_id: str = "12345", token: str = "fake_token", top_n: int = 3) -> SimpleNamespace:
    return SimpleNamespace(
        telegram_enabled=enabled,
        telegram_chat_id=chat_id,
        telegram_token=token,
        telegram_top_n=top_n,
    )


def _run() -> SimpleNamespace:
    return SimpleNamespace(
        run_id="run_test_phase23",
        run_at=datetime(2026, 5, 21, 14, 30, tzinfo=UTC),
        buy_count=4,
        hold_count=2,
        sell_count=1,
    )


@pytest.fixture
def patched_service(monkeypatch):
    """Patch repo dependencies — controllable test setup."""
    from app.services import telegram_service as svc

    state: dict[str, Any] = {
        "run": _run(),
        "settings": _settings(enabled=True),
        "rows": [],
        "post_called_with": None,
        "post_result": {"sent": True, "error": None},
    }

    monkeypatch.setattr(svc.screening_repo, "get", lambda _db, _rid: state["run"])
    monkeypatch.setattr(svc.settings_repo, "get_settings_row", lambda _db: state["settings"])
    monkeypatch.setattr(svc.results_repo, "list_by_run", lambda _db, _rid: state["rows"])

    def fake_post(*, chat_id: str, token: str, text: str) -> dict:
        state["post_called_with"] = {"chat_id": chat_id, "token": token, "text": text}
        return state["post_result"]

    monkeypatch.setattr(svc, "_post_message", fake_post)
    return svc, state


def test_skipped_when_run_not_found(patched_service, mock_db):
    svc, state = patched_service
    state["run"] = None
    out = svc.broadcast_run_summary(mock_db, "run_missing")
    assert out["skipped"] is True
    assert out["sent"] is False
    assert state["post_called_with"] is None


def test_skipped_when_telegram_disabled(patched_service, mock_db):
    """AC-14-01: enabled=false → KHÔNG gửi, KHÔNG lỗi."""
    svc, state = patched_service
    state["settings"] = _settings(enabled=False)
    out = svc.broadcast_run_summary(mock_db, "run_x")
    assert out == {"sent": False, "error": None, "skipped": True}
    assert state["post_called_with"] is None


def test_misconfig_enabled_but_creds_empty(patched_service, mock_db, monkeypatch):
    """enabled=true + creds rỗng (cả settings và env) → sent=False, NOT skipped (warning surfaces)."""
    svc, state = patched_service
    state["settings"] = _settings(enabled=True, chat_id="", token="")

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "")
    from app.config import get_settings
    get_settings.cache_clear()
    try:
        out = svc.broadcast_run_summary(mock_db, "run_x")
    finally:
        get_settings.cache_clear()

    assert out["sent"] is False
    assert out["skipped"] is False
    assert "chưa cấu hình" in out["error"]
    assert state["post_called_with"] is None


def test_message_text_matches_f14_template(patched_service, mock_db):
    """AC-14-02 + AC-14-04: Top-N format từ f14 UC-14-01 Message Template."""
    svc, state = patched_service
    state["settings"] = _settings(enabled=True, top_n=3)
    state["rows"] = [
        _row("VHM", score=85.4, upside=12.3, signal="MUA_NGAY", warnings='["LOW_LIQUIDITY"]'),
        _row("KDH", score=78.0, upside=8.0, signal="CHO_DIEU_CHINH"),
        _row("NLG", score=72.6, upside=5.5, signal="MUA_NGAY"),
        _row("DXG", score=60.0, upside=3.0, signal="CHO_DIEU_CHINH"),  # outside top 3
    ]

    out = svc.broadcast_run_summary(mock_db, "run_x")
    assert out["sent"] is True
    text = state["post_called_with"]["text"]

    # Header
    assert "🔍 VN RE AI Screener — Run 2026-05-21 14:30" in text
    # Counts
    assert "📊 Kết quả: 4 MUA | 2 GIỮ | 1 BÁN" in text
    # Top 3 in score-DESC order; DXG should NOT appear
    assert "🏆 Top 3 MUA:" in text
    assert "1. VHM — Score 85 — ▲12.3% — MUA_NGAY" in text
    assert "2. KDH — Score 78 — ▲8% — CHO_DIEU_CHINH" in text
    assert "3. NLG — Score 73 — ▲5.5% — MUA_NGAY" in text
    assert "DXG" not in text
    # Warnings count — 1 row has non-empty warnings array
    assert "⚠️ Cảnh báo: 1 mã có risk flags" in text
    # App URL footer
    assert "⚡ Xem chi tiết:" in text


def test_top_n_5_respects_settings(patched_service, mock_db):
    svc, state = patched_service
    state["settings"] = _settings(enabled=True, top_n=5)
    state["rows"] = [_row(f"T{i:02d}", score=90 - i, upside=10 - i, signal="MUA_NGAY") for i in range(7)]

    svc.broadcast_run_summary(mock_db, "run_x")
    text = state["post_called_with"]["text"]
    assert "🏆 Top 5 MUA:" in text
    # First 5 present
    for i in range(5):
        assert f"T{i:02d}" in text
    # Beyond top 5 absent
    assert "T05" not in text
    assert "T06" not in text


def test_only_buy_rows_in_top(patched_service, mock_db):
    """Top list chỉ chứa MUA — bỏ GIU/BAN ngay cả khi score cao hơn."""
    svc, state = patched_service
    state["rows"] = [
        SimpleNamespace(
            ticker="HIGH_HOLD",
            ai_score=99.0,
            upside_pct=20.0,
            entry_signal="—",
            recommendation=Recommendation.GIU.value,
            warning_badges_json="[]",
        ),
        _row("BUY1", score=70.0, upside=5.0, signal="MUA_NGAY"),
    ]
    svc.broadcast_run_summary(mock_db, "run_x")
    text = state["post_called_with"]["text"]
    assert "HIGH_HOLD" not in text
    assert "BUY1" in text


def test_bot_api_failure_returns_error_non_blocking(patched_service, mock_db):
    """AC-14-03: API lỗi → sent=False + error, KHÔNG raise."""
    svc, state = patched_service
    state["post_result"] = {"sent": False, "error": "Unauthorized"}
    out = svc.broadcast_run_summary(mock_db, "run_x")
    assert out["sent"] is False
    assert out["error"] == "Unauthorized"
    assert out["skipped"] is False


def test_post_message_timeout_does_not_leak(monkeypatch):
    """Verify _post_message converts httpx.TimeoutException → friendly error."""
    from app.services import telegram_service as svc

    def raise_timeout(*_a, **_kw):
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx, "post", raise_timeout)
    out = svc._post_message(chat_id="x", token="secret_token", text="ping")
    assert out["sent"] is False
    assert out["error"] == "Telegram API timeout"
    # Critical: token MUST NOT appear in error message (TAD g05 log scrub).
    assert "secret_token" not in out["error"]


def test_post_message_429_retry_then_success(monkeypatch):
    """Phase 28 — 429 with `Retry-After: 0` → retry, second call success."""
    from app.services import telegram_service as svc

    sleeps: list[float] = []
    monkeypatch.setattr(svc.time, "sleep", lambda s: sleeps.append(s))

    call_log: list[str] = []

    class _Resp429:
        status_code = 429
        headers = {"content-type": "application/json", "retry-after": "0"}

        def json(self) -> dict:
            return {"ok": False, "description": "Too Many Requests", "parameters": {"retry_after": 0}}

    class _Resp200:
        status_code = 200
        headers = {"content-type": "application/json"}

        def json(self) -> dict:
            return {"ok": True, "result": {"message_id": 42}}

    def fake_post(*_a, **_kw):
        call_log.append("call")
        return _Resp429() if len(call_log) == 1 else _Resp200()

    monkeypatch.setattr(httpx, "post", fake_post)

    out = svc._post_message(chat_id="x", token="t", text="hi")
    assert out == {"sent": True, "error": None}
    assert len(call_log) == 2, "Bot API must be retried once after 429"
    assert sleeps == [0.0], "must honor retry_after value"


def test_post_message_429_persistent_returns_error(monkeypatch):
    """Phase 28 — 429 again after retry → return error, KHÔNG retry loop."""
    from app.services import telegram_service as svc

    monkeypatch.setattr(svc.time, "sleep", lambda _s: None)
    call_log: list[str] = []

    class _Resp429:
        status_code = 429
        headers = {"content-type": "application/json"}

        def json(self) -> dict:
            return {
                "ok": False,
                "description": "Too Many Requests: retry after 2",
                "parameters": {"retry_after": 2},
            }

    def fake_post(*_a, **_kw):
        call_log.append("call")
        return _Resp429()

    monkeypatch.setattr(httpx, "post", fake_post)

    out = svc._post_message(chat_id="x", token="t", text="hi")
    assert out["sent"] is False
    assert "Too Many Requests" in out["error"]
    assert len(call_log) == 2, "exactly 1 retry (initial + 1) — không retry loop"


def test_post_message_retry_after_capped(monkeypatch):
    """Phase 28 — `Retry-After: 99999` capped to _RATE_LIMIT_MAX_WAIT_S."""
    from app.services import telegram_service as svc

    sleeps: list[float] = []
    monkeypatch.setattr(svc.time, "sleep", lambda s: sleeps.append(s))

    class _Resp429:
        status_code = 429
        headers = {"content-type": "application/json", "retry-after": "99999"}

        def json(self) -> dict:
            return {"ok": False, "description": "Too Many Requests"}

    class _Resp200:
        status_code = 200
        headers = {"content-type": "application/json"}

        def json(self) -> dict:
            return {"ok": True}

    calls: list[str] = []

    def fake_post(*_a, **_kw):
        calls.append("c")
        return _Resp429() if len(calls) == 1 else _Resp200()

    monkeypatch.setattr(httpx, "post", fake_post)
    out = svc._post_message(chat_id="x", token="t", text="hi")
    assert out["sent"] is True
    assert sleeps == [svc._RATE_LIMIT_MAX_WAIT_S]


def test_post_message_http_error_scrubs_url(monkeypatch):
    """httpx generic HTTPError → log/error message KHÔNG include URL/token."""
    from app.services import telegram_service as svc

    class FakeHTTPError(httpx.HTTPError):
        def __str__(self) -> str:  # noqa: D401
            return "request to https://api.telegram.org/botSECRET_TOKEN/sendMessage failed"

    def raise_http_error(*_a, **_kw):
        raise FakeHTTPError("request to https://api.telegram.org/botSECRET_TOKEN/sendMessage failed")

    monkeypatch.setattr(httpx, "post", raise_http_error)
    out = svc._post_message(chat_id="x", token="SECRET_TOKEN", text="ping")
    assert out["sent"] is False
    assert "SECRET_TOKEN" not in out["error"]
    assert "FakeHTTPError" in out["error"]
