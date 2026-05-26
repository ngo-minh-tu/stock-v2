"""Phase 26 — KBS snapshot regression + bvps fallback + period suffix collision log.

Goal:
1. Snapshot test: full KBS-shape DataFrame fixture → parser → assert golden values
   per canonical field. Detects schema drift (column rename, prefix change,
   blocklist regression).
2. bvps compute fallback: when KBS doesn't return `bvps`, `_compute_derived_fields`
   fills from `total_equity / shares_outstanding`.
3. Period suffix collision log: parser emits `info` log for periods with both
   base + restated columns.
"""

from __future__ import annotations

import logging

import pandas as pd
from app.crawlers.vnstock_client import VnstockClient

from tests.fixtures.kbs_snapshot import (
    KBS_2026Q1_GOLDEN,
    kbs_balance_sheet_snapshot,
    kbs_cash_flow_snapshot,
    kbs_income_statement_snapshot,
    kbs_ratio_snapshot,
)

# `fake_vnstock_financial_module` + `_reset_rate_gate` auto-resolved từ
# `tests/unit/conftest.py` (Phase 26).


def test_kbs_snapshot_full_parse_to_golden(fake_vnstock_financial_module):
    """End-to-end: KBS snapshot DataFrame → VnstockClient → 1 merged row khớp golden.

    Regression guard: nếu vnstock đổi KBS shape (item_id pattern, column rename,
    grand-total wording), test fail và force review.
    """

    class _KbsOnlyFinance:
        """Simulate VCI empty + KBS returns snapshot — exercises full merge path."""

        def __init__(self, source: str, **_kwargs) -> None:
            self._source = source

        def income_statement(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame()  # VCI empty → KBS fills
            return kbs_income_statement_snapshot()

        def balance_sheet(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame()
            return kbs_balance_sheet_snapshot()

        def cash_flow(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame()
            return kbs_cash_flow_snapshot()

        def ratio(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame()
            return kbs_ratio_snapshot()

    fake_vnstock_financial_module(_KbsOnlyFinance)
    rows = VnstockClient(rate_limit_s=0.0).fetch_financials("NLG")

    by_period = {r["period"]: r for r in rows}
    assert "2026Q1" in by_period, "2026-Q1 must parse to canonical period key"
    row = by_period["2026Q1"]

    # Spot-check critical canonical fields
    for field, expected in KBS_2026Q1_GOLDEN.items():
        actual = row.get(field)
        assert actual is not None, f"{field} missing — schema drift?"
        assert abs(actual - expected) < 1e-3, (
            f"{field}: expected {expected}, got {actual}"
        )

    # Grand total row MUST NOT have leaked into total_assets via greedy match.
    # Golden total_assets = 25_894_000_000 (raw VND after scaling).
    # If blocklist regresses, total_assets might double or pick the grand total.
    assert row["total_assets"] == 25_894_000.0 * 1000.0


def test_kbs_snapshot_period_suffix_logs_collision(fake_vnstock_financial_module, caplog):
    """Phase 26 — `_log_period_suffix_collisions` emits log when both
    `2025-Q4` AND `2025-Q4_1` (restated) cùng present. Phase 28 dropped to DEBUG
    level (refresh production có thể emit hàng trăm collision)."""
    caplog.set_level(logging.DEBUG, logger="app.crawlers.vnstock_client")

    class _KbsOnlyFinance:
        def __init__(self, source: str, **_kwargs) -> None:
            self._source = source

        def income_statement(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame()
            return kbs_income_statement_snapshot()

        def balance_sheet(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame()
            return kbs_balance_sheet_snapshot()

        def cash_flow(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame()
            return pd.DataFrame()

        def ratio(self, **_kwargs):
            return pd.DataFrame()

    fake_vnstock_financial_module(_KbsOnlyFinance)
    VnstockClient(rate_limit_s=0.0).fetch_financials("NLG")

    assert "period suffix collision" in caplog.text, (
        "parser must log when base + restated period variants collide"
    )
    assert "2025-Q4" in caplog.text


def test_bvps_fallback_when_parser_misses(fake_vnstock_financial_module):
    """Phase 26 — bvps không có từ parser thì compute từ total_equity / shares_outstanding."""

    class _Finance:
        def __init__(self, source: str, **_kwargs) -> None:
            self._source = source

        def income_statement(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame()
            return pd.DataFrame()  # no income data needed

        def balance_sheet(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame(
                    [{"item_id": "total_equity", "2026-Q1": 14_910_000_000_000.0}]
                )
            return pd.DataFrame()

        def cash_flow(self, **_kwargs):
            return pd.DataFrame()

        def ratio(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame(
                    [{"item_id": "shares_outstanding", "2026-Q1": 380_000_000.0}]
                )
            return pd.DataFrame()

    fake_vnstock_financial_module(_Finance)
    rows = VnstockClient(rate_limit_s=0.0).fetch_financials("NLG")
    assert len(rows) == 1
    row = rows[0]
    assert row.get("bvps") is not None, "bvps fallback must compute from equity/shares"
    expected = 14_910_000_000_000.0 / 380_000_000.0
    assert abs(row["bvps"] - expected) < 1e-3


def test_bvps_fallback_skipped_when_parser_already_filled(fake_vnstock_financial_module):
    """Parser thắng — fallback KHÔNG ghi đè giá trị bvps đã có."""
    PARSER_BVPS = 12_345.0

    class _Finance:
        def __init__(self, source: str, **_kwargs) -> None:
            self._source = source

        def income_statement(self, **_kwargs):
            return pd.DataFrame()

        def balance_sheet(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame(
                    [{"item_id": "total_equity", "2026-Q1": 14_910_000_000_000.0}]
                )
            return pd.DataFrame()

        def cash_flow(self, **_kwargs):
            return pd.DataFrame()

        def ratio(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame(
                    [
                        {"item_id": "shares_outstanding", "2026-Q1": 380_000_000.0},
                        {"item_id": "bvps", "2026-Q1": PARSER_BVPS},
                    ]
                )
            return pd.DataFrame()

    fake_vnstock_financial_module(_Finance)
    rows = VnstockClient(rate_limit_s=0.0).fetch_financials("NLG")
    assert rows[0]["bvps"] == PARSER_BVPS, "parser-provided bvps must win over fallback"


def test_bvps_fallback_skipped_when_inputs_invalid(fake_vnstock_financial_module):
    """Equity ≤ 0 hoặc shares ≤ 0 → KHÔNG compute (chia 0 / meaningless)."""

    class _Finance:
        def __init__(self, source: str, **_kwargs) -> None:
            self._source = source

        def income_statement(self, **_kwargs):
            return pd.DataFrame()

        def balance_sheet(self, **_kwargs):
            if self._source == "VCI":
                # Negative equity (insolvent ticker) → no bvps
                return pd.DataFrame(
                    [{"item_id": "total_equity", "2026-Q1": -100_000.0}]
                )
            return pd.DataFrame()

        def cash_flow(self, **_kwargs):
            return pd.DataFrame()

        def ratio(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame(
                    [{"item_id": "shares_outstanding", "2026-Q1": 380_000_000.0}]
                )
            return pd.DataFrame()

    fake_vnstock_financial_module(_Finance)
    rows = VnstockClient(rate_limit_s=0.0).fetch_financials("NLG")
    assert rows[0].get("bvps") is None
