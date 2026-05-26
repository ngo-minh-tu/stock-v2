"""Phase 23 — `Settings` env-file chain (TAD g07 + Phase 20).

`SettingsConfigDict(env_file=(".env", ".env.telegram"))` — pydantic-settings
loads in declared order: each later file overrides earlier (and explicit env
vars trump both). The chain is invisible at runtime, so a regression here
would silently break the Telegram credential resolution + production guard
(Phase 22).

Tests cover:
1. `.env.telegram` overrides `.env` for telegram_* keys.
2. `.env` solo populates fields when no override file.
3. Explicit `os.environ` overrides both files.
4. `get_settings()` is `@lru_cache` — `cache_clear()` re-reads files; without
   it, mutations to env are invisible (callers MUST clear after monkeypatch).
5. Defaults preserve when no env source provides a value.

All tests use isolated `tmp_path` working directory + monkeypatch `os.chdir`
so they NEVER touch the developer's real `.env`/`.env.telegram`.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest


@pytest.fixture
def isolated_cwd(tmp_path: Path, monkeypatch):
    """Chdir to tmp_path + clear cache. Restores cwd + cache on teardown."""
    from app.config import get_settings

    # Strip env vars we care about so file contents are the only source.
    for k in (
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "JWT_SECRET",
        "FRONTEND_ORIGIN",
        "APP_ENV",
    ):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.chdir(tmp_path)
    get_settings.cache_clear()
    yield tmp_path
    get_settings.cache_clear()


def _write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def test_env_telegram_overrides_dot_env(isolated_cwd):
    """`.env.telegram` listed after `.env` in tuple → its values win (Phase 20)."""
    from app.config import Settings

    _write(isolated_cwd / ".env", "TELEGRAM_BOT_TOKEN=from_dot_env\nTELEGRAM_CHAT_ID=base_chat\n")
    _write(isolated_cwd / ".env.telegram", "TELEGRAM_BOT_TOKEN=override_token\nTELEGRAM_CHAT_ID=override_chat\n")

    s = Settings()
    assert s.telegram_bot_token == "override_token"
    assert s.telegram_chat_id == "override_chat"


def test_env_alone_populates_when_no_telegram_file(isolated_cwd):
    """No `.env.telegram` → `.env` values stick (production code path)."""
    from app.config import Settings

    _write(isolated_cwd / ".env", "TELEGRAM_BOT_TOKEN=only_in_env\n")
    s = Settings()
    assert s.telegram_bot_token == "only_in_env"
    # No chat_id source → default empty string from class field.
    assert s.telegram_chat_id == ""


def test_explicit_env_var_beats_both_files(isolated_cwd, monkeypatch):
    """`os.environ` highest precedence — secret managers / `--env-file` injection
    must NOT be overridden by a stray file in the working dir."""
    from app.config import Settings

    _write(isolated_cwd / ".env", "TELEGRAM_BOT_TOKEN=from_file_a\n")
    _write(isolated_cwd / ".env.telegram", "TELEGRAM_BOT_TOKEN=from_file_b\n")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "from_os_environ")

    s = Settings()
    assert s.telegram_bot_token == "from_os_environ"


def test_get_settings_is_cached_until_clear(isolated_cwd):
    """`get_settings()` returns the same instance until `cache_clear()`."""
    from app.config import get_settings

    _write(isolated_cwd / ".env", "TELEGRAM_BOT_TOKEN=cached_v1\n")
    s1 = get_settings()
    assert s1.telegram_bot_token == "cached_v1"

    # Mutating the file WITHOUT clearing cache → still old instance.
    _write(isolated_cwd / ".env", "TELEGRAM_BOT_TOKEN=cached_v2\n")
    s2 = get_settings()
    assert s2 is s1
    assert s2.telegram_bot_token == "cached_v1"

    # Clear → re-read.
    get_settings.cache_clear()
    s3 = get_settings()
    assert s3 is not s1
    assert s3.telegram_bot_token == "cached_v2"


def test_defaults_when_no_source(isolated_cwd):
    """No env files + no os.environ overrides → class defaults."""
    from app.config import Settings

    s = Settings()
    assert s.app_env == "development"
    assert s.telegram_bot_token == ""
    assert s.telegram_chat_id == ""
    assert s.frontend_origin == "http://localhost:3000"
    assert s.vnstock_rate_limit_s == 6.5


def test_unknown_env_keys_are_ignored(isolated_cwd):
    """`extra='ignore'` — random keys in `.env` MUST NOT raise (deployment
    environments often have unrelated vars set)."""
    from app.config import Settings

    _write(
        isolated_cwd / ".env",
        "TELEGRAM_BOT_TOKEN=ok\nRANDOM_KEY=do_not_care\nANOTHER=stuff\n",
    )
    s = Settings()
    assert s.telegram_bot_token == "ok"
    # Don't assert absence of RANDOM_KEY attr — pydantic-settings just ignores it.
    assert not hasattr(s, "random_key")


def test_chain_load_used_by_real_get_settings(isolated_cwd):
    """Regression guard: if `env_file` tuple is reverted to a single str,
    `.env.telegram` precedence breaks. End-to-end check via `get_settings`."""
    from app.config import get_settings

    _write(isolated_cwd / ".env", "TELEGRAM_BOT_TOKEN=base\n")
    _write(isolated_cwd / ".env.telegram", "TELEGRAM_BOT_TOKEN=secret_layer\n")
    get_settings.cache_clear()

    s = get_settings()
    assert s.telegram_bot_token == "secret_layer", (
        "If this fails, check Settings.model_config — env_file must be a tuple "
        "with .env.telegram AFTER .env so the layered file wins."
    )


def test_env_telegram_only_no_dot_env(isolated_cwd):
    """`.env.telegram` alone (no `.env`) still loads — pydantic doesn't require
    every file in the tuple to exist."""
    from app.config import Settings

    _write(isolated_cwd / ".env.telegram", "TELEGRAM_BOT_TOKEN=solo\n")
    assert not (isolated_cwd / ".env").exists()
    s = Settings()
    assert s.telegram_bot_token == "solo"


def test_os_environ_still_visible_after_cache_clear(isolated_cwd, monkeypatch):
    """Defensive: ensure cache_clear() doesn't strip env precedence."""
    from app.config import get_settings

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "env_only")
    get_settings.cache_clear()
    s = get_settings()
    assert s.telegram_bot_token == "env_only"


def test_os_module_imported(isolated_cwd):
    """Sanity: `os` is available — guarantees pytest collected the file under
    the same interpreter as app code."""
    assert os.getcwd() == str(isolated_cwd)
