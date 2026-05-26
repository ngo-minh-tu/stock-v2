"""Telegram test endpoint — TAD g02 §9.4 + SRS f14 + TAD c07.

Mock httpx requests to avoid hitting the real Bot API. Verify envelope
`success: true` even when `sent: false` (TAD c07 §4: app-level error in data).
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest


@pytest.fixture
def restore_settings_telegram():
    """Snapshot telegram settings columns + restore."""
    from app.db.session import SessionLocal
    from app.models import Settings as SettingsRow

    with SessionLocal() as db:
        s = db.get(SettingsRow, 1)
        snap = (s.telegram_chat_id, s.telegram_token, s.telegram_enabled)
    yield
    with SessionLocal() as db:
        s = db.get(SettingsRow, 1)
        s.telegram_chat_id, s.telegram_token, s.telegram_enabled = snap
        db.commit()


def _set_creds(chat_id: str, token: str) -> None:
    from app.db.session import SessionLocal
    from app.models import Settings as SettingsRow

    with SessionLocal() as db:
        s = db.get(SettingsRow, 1)
        s.telegram_chat_id = chat_id
        s.telegram_token = token
        db.commit()


def test_test_requires_auth(client):
    assert client.post("/api/telegram/test").status_code == 401


def test_unconfigured_returns_sent_false(
    client, auth_headers, restore_settings_telegram, monkeypatch
):
    """Settings empty + env empty → `sent=false` với clear error message.

    Phase 20 chain-loads `.env.telegram` for local dev, so env vars are
    populated. The unconfigured-path test must clear them explicitly to
    exercise the empty-credentials branch — otherwise the endpoint would
    fall back to the developer's real Bot creds and hit the live API.
    """
    from app.config import get_settings

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "")
    get_settings.cache_clear()
    try:
        _set_creds("", "")
        r = client.post("/api/telegram/test", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["sent"] is False
        assert body["data"]["error"] is not None
        assert "chưa cấu h\xecnh" in body["data"]["error"]  # "chưa cấu hình"
    finally:
        get_settings.cache_clear()


def test_telegram_api_success(client, auth_headers, restore_settings_telegram, monkeypatch):
    """Mock Bot API trả ok=true → `sent=true, error=null`."""
    _set_creds("12345", "fake_token")

    def fake_post(url: str, json: dict, timeout: float) -> Any:  # noqa: ARG001
        class R:
            status_code = 200
            headers = {"content-type": "application/json"}

            def json(self) -> dict:
                return {"ok": True, "result": {"message_id": 1}}

        return R()

    monkeypatch.setattr(httpx, "post", fake_post)

    r = client.post("/api/telegram/test", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["sent"] is True
    assert data["error"] is None


def test_telegram_api_failure_returns_envelope_with_error(
    client, auth_headers, restore_settings_telegram, monkeypatch
):
    """Mock Bot API trả 401 invalid token → envelope success but sent=false + error."""
    _set_creds("12345", "bad_token")

    def fake_post(url: str, json: dict, timeout: float) -> Any:  # noqa: ARG001
        class R:
            status_code = 401
            headers = {"content-type": "application/json"}

            def json(self) -> dict:
                return {"ok": False, "description": "Unauthorized"}

        return R()

    monkeypatch.setattr(httpx, "post", fake_post)

    r = client.post("/api/telegram/test", headers=auth_headers)
    # AC-NF: HTTP 200 envelope success — Telegram error trong data
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["sent"] is False
    assert "Unauthorized" in body["data"]["error"]


def test_telegram_timeout(client, auth_headers, restore_settings_telegram, monkeypatch):
    _set_creds("12345", "fake_token")

    def fake_post(url: str, json: dict, timeout: float) -> Any:  # noqa: ARG001
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx, "post", fake_post)

    r = client.post("/api/telegram/test", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["data"]["sent"] is False
    assert r.json()["data"]["error"] == "Telegram API timeout"


def test_settings_priority_over_env_var(
    client, auth_headers, restore_settings_telegram, monkeypatch
):
    """TAD c07 §1.1: settings table priority over env var. Settings có chat_id/token →
    use those; env var fallback only when settings empty."""
    _set_creds("settings_chat", "settings_token")
    # Env var should be ignored
    captured: dict = {}

    def fake_post(url: str, json: dict, timeout: float) -> Any:  # noqa: ARG001
        captured["url"] = url
        captured["chat_id"] = json["chat_id"]

        class R:
            status_code = 200
            headers = {"content-type": "application/json"}

            def json(self) -> dict:
                return {"ok": True}

        return R()

    monkeypatch.setattr(httpx, "post", fake_post)

    client.post("/api/telegram/test", headers=auth_headers)
    assert captured["url"].startswith("https://api.telegram.org/botsettings_token/")
    assert captured["chat_id"] == "settings_chat"
