"""Phase 25 — `feature_service._warn_total_assets_range` sanity guard.

Sentinel cho source-unit drift sau Phase 22 source-aware scaling. Warn-log only,
KHÔNG block screening — false-positive cho ticker mới list không có BCTC chấp
nhận được, KHÔNG raise.

Coverage:
1. total_assets >= 1e9 → no warn.
2. total_assets > 0 but < 1e9 → warn (drift sentinel).
3. total_assets = 0 → no warn (treat as missing, đã có khác handler).
4. total_assets = None → no warn (early return).
5. total_assets non-numeric → no warn (defensive).
"""

from __future__ import annotations

import logging

from app.models.financial import FinancialReport
from app.services.feature_service import (
    _warn_all_sanity_fields,
    _warn_total_assets_range,
    _warn_total_equity_range,
)


def _row(total_assets, *, total_equity=None) -> FinancialReport:
    return FinancialReport(
        ticker="TST",
        period="2026Q1",
        year=2026,
        quarter=1,
        total_assets=total_assets,
        total_equity=total_equity,
    )


def test_no_warn_when_total_assets_above_floor(caplog):
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_assets_range("VHM", _row(5e14))  # 500T VND raw
    assert "below sanity floor" not in caplog.text


def test_warn_when_total_assets_below_floor(caplog):
    """e.g. ngàn đồng leak through Phase 22 source-aware scaling → ~ 1e7."""
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_assets_range("KBS", _row(1e7))  # 10 triệu VND raw — clearly drift
    assert "TST" not in caplog.text  # ticker passed in is KBS
    assert "KBS" in caplog.text
    assert "below sanity floor" in caplog.text
    assert "2026Q1" in caplog.text


def test_no_warn_when_zero(caplog):
    """total_assets=0 = missing-data sentinel; handled by feature compute, not range."""
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_assets_range("XYZ", _row(0))
    assert "below sanity floor" not in caplog.text


def test_no_warn_when_none(caplog):
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_assets_range("XYZ", _row(None))
    assert "below sanity floor" not in caplog.text


def test_no_raise_on_non_numeric(caplog):
    """Defensive — corrupt row với total_assets='abc' không crash."""
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_assets_range("XYZ", _row("not a number"))
    assert "below sanity floor" not in caplog.text


def test_boundary_at_exactly_floor(caplog):
    """value === floor → no warn (sanity says ≥ floor OK)."""
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_assets_range("XYZ", _row(1e9))
    assert "below sanity floor" not in caplog.text


# Phase 27 — `_warn_total_equity_range` analog cho equity (bvps fallback divisor).


def test_equity_no_warn_above_floor(caplog):
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_equity_range("VHM", _row(None, total_equity=5e13))  # 50T VND
    assert "total_equity" not in caplog.text


def test_equity_warn_below_floor(caplog):
    """Equity raw ngàn đồng leak (no scaling) → ~1e7 → trigger warn."""
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_equity_range("KBS_TEST", _row(None, total_equity=1e7))
    assert "KBS_TEST" in caplog.text
    assert "total_equity" in caplog.text
    assert "below sanity floor" in caplog.text
    assert "bvps fallback có thể sai" in caplog.text


def test_equity_no_warn_when_none(caplog):
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_equity_range("XYZ", _row(None, total_equity=None))
    assert "total_equity" not in caplog.text


def test_equity_no_warn_when_zero_or_negative(caplog):
    """Insolvent ticker (equity ≤ 0) — `_compute_derived_fields` đã skip bvps,
    no need to flag at feature_service boundary."""
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_equity_range("INS", _row(None, total_equity=0))
    _warn_total_equity_range("INS", _row(None, total_equity=-1e10))
    assert "below sanity floor" not in caplog.text


def test_equity_no_raise_on_non_numeric(caplog):
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_total_equity_range("XYZ", _row(None, total_equity="abc"))
    assert "below sanity floor" not in caplog.text


# Phase 28 — consolidated helper test.


def test_consolidated_helper_iterates_all_fields(caplog):
    """`_warn_all_sanity_fields` emits 1 warning per field below floor."""
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    # Both fields below floor → 2 warning lines.
    _warn_all_sanity_fields("DRIFT", _row(1e7, total_equity=1e7))
    assert caplog.text.count("below sanity floor") == 2
    assert "total_assets=" in caplog.text
    assert "total_equity=" in caplog.text
    assert "bvps fallback có thể sai" in caplog.text


def test_consolidated_helper_no_warn_when_all_above(caplog):
    """All fields ≥ floor → no log line."""
    caplog.set_level(logging.WARNING, logger="app.services.feature_service")
    _warn_all_sanity_fields("OK", _row(5e14, total_equity=5e13))
    assert "below sanity floor" not in caplog.text
