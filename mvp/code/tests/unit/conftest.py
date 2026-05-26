"""Shared pytest fixtures cho `tests/unit/` — vnstock fake modules + rate-gate reset.

Phase 26: extracted từ test_vnstock_client.py để test_kbs_snapshot.py share
without import (pytest auto-resolves from conftest by name, tránh F811
redefinition khi import fixture function trực tiếp).
"""

from __future__ import annotations

import sys
import types

import pytest
from app.crawlers.vnstock_client import _gate


@pytest.fixture(autouse=True)
def _reset_rate_gate():
    """Reset module-level rate gate so tests don't sleep between runs."""
    _gate._last_call_ts = 0.0
    yield
    _gate._last_call_ts = 0.0


@pytest.fixture
def fake_vnstock_module(monkeypatch):
    """Inject fake `vnstock.api.quote` so wrapper's lazy import resolves to stub."""

    def set_behaviour(history_callable):
        class _DataSource:
            VCI = "vci"

        class _TimeResolutions:
            DAY_1 = "1D"

        class _Quote:
            def __init__(self, **_kwargs):
                pass

            def history(self, **kwargs):
                return history_callable(**kwargs)

        mod = types.ModuleType("vnstock")
        api_mod = types.ModuleType("vnstock.api")
        quote_mod = types.ModuleType("vnstock.api.quote")
        quote_mod.DataSource = _DataSource
        quote_mod.Quote = _Quote
        quote_mod.TimeResolutions = _TimeResolutions
        monkeypatch.setitem(sys.modules, "vnstock", mod)
        monkeypatch.setitem(sys.modules, "vnstock.api", api_mod)
        monkeypatch.setitem(sys.modules, "vnstock.api.quote", quote_mod)

    yield set_behaviour
    for name in ("vnstock.api.quote", "vnstock.api", "vnstock"):
        sys.modules.pop(name, None)


@pytest.fixture
def fake_vnstock_financial_module(monkeypatch):
    def set_behaviour(finance_cls):
        mod = types.ModuleType("vnstock")
        api_mod = types.ModuleType("vnstock.api")
        financial_mod = types.ModuleType("vnstock.api.financial")
        financial_mod.Finance = finance_cls
        monkeypatch.setitem(sys.modules, "vnstock", mod)
        monkeypatch.setitem(sys.modules, "vnstock.api", api_mod)
        monkeypatch.setitem(sys.modules, "vnstock.api.financial", financial_mod)

    yield set_behaviour
    for name in ("vnstock.api.financial", "vnstock.api", "vnstock"):
        sys.modules.pop(name, None)
