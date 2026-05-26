"""Phase 23 — `screening_service` finalize hook gọi `broadcast_run_summary`.

End-to-end coverage:
1. enabled=false → run COMPLETED, telegram_sent=False, KHÔNG có TELEGRAM_FAILED warning.
2. enabled=true + Bot API ok → run COMPLETED, telegram_sent=True, warnings không
   chứa TELEGRAM_FAILED.
3. enabled=true + Bot API fail → run COMPLETED_WITH_WARNINGS, telegram_sent=False,
   telegram_error populated, warnings chứa TELEGRAM_FAILED.

Mock httpx.post — KHÔNG hit real Bot API.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from app.db.session import SessionLocal
from app.models import Settings as SettingsRow
from app.models.run import ScreeningRun


def _set_telegram(*, enabled: bool, chat_id: str = "12345", token: str = "fake_token") -> None:
    with SessionLocal() as db:
        s = db.get(SettingsRow, 1)
        s.telegram_enabled = enabled
        s.telegram_chat_id = chat_id
        s.telegram_token = token
        db.commit()


def _fetch_run(run_id: str) -> ScreeningRun:
    with SessionLocal() as db:
        row = db.get(ScreeningRun, run_id)
        assert row is not None
        db.expunge(row)
        return row


@pytest.fixture
def fake_telegram_ok(monkeypatch):
    captured: dict[str, Any] = {"called": False, "text": None, "url": None}

    def fake_post(url: str, json: dict, timeout: float) -> Any:  # noqa: ARG001
        captured["called"] = True
        captured["text"] = json["text"]
        captured["url"] = url

        class R:
            status_code = 200
            headers = {"content-type": "application/json"}

            def json(self) -> dict:
                return {"ok": True, "result": {"message_id": 99}}

        return R()

    monkeypatch.setattr(httpx, "post", fake_post)
    return captured


@pytest.fixture
def fake_telegram_fail(monkeypatch):
    """Bot trả 401 invalid token."""
    def fake_post(*_a, **_kw) -> Any:
        class R:
            status_code = 401
            headers = {"content-type": "application/json"}

            def json(self) -> dict:
                return {"ok": False, "description": "Unauthorized"}

        return R()

    monkeypatch.setattr(httpx, "post", fake_post)


def test_finalize_skipped_when_telegram_disabled(
    client, auth_headers, screening_data, restore_settings, monkeypatch
):
    _set_telegram(enabled=False)

    def boom(*_a, **_kw):  # pragma: no cover — should never be called
        raise AssertionError("httpx.post called despite telegram_enabled=False")

    monkeypatch.setattr(httpx, "post", boom)

    r = client.post("/api/run", json={"total_capital": 0}, headers=auth_headers)
    assert r.status_code == 202
    run_id = r.json()["data"]["run_id"]

    run = _fetch_run(run_id)
    assert run.status in ("COMPLETED", "COMPLETED_WITH_WARNINGS")
    assert run.telegram_sent is False
    assert run.telegram_error is None
    warnings = json.loads(run.warnings_json or "[]")
    assert "TELEGRAM_FAILED" not in warnings


def test_finalize_sends_summary_when_enabled(
    client, auth_headers, screening_data, restore_settings, fake_telegram_ok
):
    _set_telegram(enabled=True)

    r = client.post("/api/run", json={"total_capital": 0}, headers=auth_headers)
    assert r.status_code == 202
    run_id = r.json()["data"]["run_id"]

    run = _fetch_run(run_id)
    assert run.telegram_sent is True
    assert run.telegram_error is None
    warnings = json.loads(run.warnings_json or "[]")
    assert "TELEGRAM_FAILED" not in warnings

    # Verify Bot API URL + composed text format
    assert fake_telegram_ok["called"] is True
    assert fake_telegram_ok["url"].startswith("https://api.telegram.org/botfake_token/")
    text = fake_telegram_ok["text"]
    assert "🔍 VN RE AI Screener — Run" in text
    assert "🏆 Top " in text


def test_finalize_failure_tags_warning_and_preserves_run(
    client, auth_headers, screening_data, restore_settings, fake_telegram_fail
):
    """AC-14-03: Bot API lỗi → run KHÔNG fail; gắn TELEGRAM_FAILED + telegram_error."""
    _set_telegram(enabled=True)

    r = client.post("/api/run", json={"total_capital": 0}, headers=auth_headers)
    assert r.status_code == 202
    run_id = r.json()["data"]["run_id"]

    run = _fetch_run(run_id)
    # COMPLETED_WITH_WARNINGS because TELEGRAM_FAILED is now in warnings_json.
    assert run.status == "COMPLETED_WITH_WARNINGS"
    assert run.telegram_sent is False
    assert run.telegram_error == "Unauthorized"
    warnings = json.loads(run.warnings_json or "[]")
    assert "TELEGRAM_FAILED" in warnings
