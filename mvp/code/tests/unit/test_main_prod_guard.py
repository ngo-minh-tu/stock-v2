"""Phase 22 — `.env.telegram` production guard.

App startup must fail fast if APP_ENV=production AND `.env.telegram` is present
in the working directory. Local-only secret files must not be deployed.
"""

from __future__ import annotations

import pytest


def test_production_guard_raises_when_env_telegram_present(tmp_path, monkeypatch):
    """In production, presence of .env.telegram = misconfigured deploy → fail fast."""
    from app.config import get_settings
    from app.main import _enforce_production_secret_isolation

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env.telegram").write_text("TELEGRAM_BOT_TOKEN=fake\n")
    try:
        with pytest.raises(RuntimeError, match=".env.telegram"):
            _enforce_production_secret_isolation()
    finally:
        get_settings.cache_clear()


def test_production_guard_passes_when_env_telegram_absent(tmp_path, monkeypatch):
    """In production with no secret file present, startup proceeds normally."""
    from app.config import get_settings
    from app.main import _enforce_production_secret_isolation

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.chdir(tmp_path)
    try:
        _enforce_production_secret_isolation()  # must not raise
    finally:
        get_settings.cache_clear()


def test_production_guard_noop_in_non_production(tmp_path, monkeypatch):
    """Demo / dev / test mode may legitimately have .env.telegram (Phase 20 local convention)."""
    from app.config import get_settings
    from app.main import _enforce_production_secret_isolation

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "demo")
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env.telegram").write_text("TELEGRAM_BOT_TOKEN=fake\n")
    try:
        _enforce_production_secret_isolation()  # must not raise in demo
    finally:
        get_settings.cache_clear()


# Phase 28 — extensible `_PRODUCTION_FORBIDDEN_FILES` set tests.


def test_production_guard_uses_extensible_set(tmp_path, monkeypatch):
    """Phase 28 — adding new file to `_PRODUCTION_FORBIDDEN_FILES` activates guard
    without editing function logic. Future-proofing for additional secret files."""
    from app import main as main_module
    from app.config import get_settings
    from app.main import _enforce_production_secret_isolation

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.chdir(tmp_path)
    # Simulate adding a new forbidden file via the extensible set.
    monkeypatch.setattr(
        main_module, "_PRODUCTION_FORBIDDEN_FILES",
        frozenset({".env.slack"}),
    )
    (tmp_path / ".env.slack").write_text("SLACK_TOKEN=fake\n")
    try:
        with pytest.raises(RuntimeError, match=".env.slack"):
            _enforce_production_secret_isolation()
    finally:
        get_settings.cache_clear()


def test_production_guard_reports_multiple_leaked_files(tmp_path, monkeypatch):
    """Phase 28 — if 2+ forbidden files present, error message lists ALL của chúng
    (sorted) — không stop at first match."""
    from app import main as main_module
    from app.config import get_settings
    from app.main import _enforce_production_secret_isolation

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        main_module, "_PRODUCTION_FORBIDDEN_FILES",
        frozenset({".env.telegram", ".env.slack"}),
    )
    (tmp_path / ".env.telegram").write_text("token\n")
    (tmp_path / ".env.slack").write_text("token\n")
    try:
        with pytest.raises(RuntimeError) as exc_info:
            _enforce_production_secret_isolation()
        msg = str(exc_info.value)
        assert ".env.telegram" in msg
        assert ".env.slack" in msg
    finally:
        get_settings.cache_clear()
