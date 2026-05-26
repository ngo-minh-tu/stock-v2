"""VnstockClient wrapper boundary — TAD g04 §3.

Phase 12 added: vnstock quota path can raise SystemExit (not Exception).
Wrapper must convert it to VnstockUnavailable so refresh_service handles
it on the normal failure path.

Phase 26: shared fixtures (`_reset_rate_gate`, `fake_vnstock_module`,
`fake_vnstock_financial_module`) moved sang `conftest.py` để re-use chéo.
"""

import pandas as pd
import pytest
from app.crawlers.vnstock_client import VnstockClient, VnstockUnavailable


def test_fetch_prices_converts_systemexit_to_vnstock_unavailable(fake_vnstock_module):
    """vnstock guest quota path can call sys.exit(); wrapper must absorb it."""

    def _raise_systemexit(**_kwargs):
        raise SystemExit("Rate limit exceeded")

    fake_vnstock_module(_raise_systemexit)

    client = VnstockClient(rate_limit_s=0.0)
    with pytest.raises(VnstockUnavailable) as exc_info:
        client.fetch_prices("VHM", days=30)
    assert "VHM" in str(exc_info.value)


def test_fetch_prices_converts_generic_exception_to_vnstock_unavailable(fake_vnstock_module):
    """Network/library RuntimeError must also be wrapped as VnstockUnavailable."""

    def _raise_runtime(**_kwargs):
        raise RuntimeError("Connection refused")

    fake_vnstock_module(_raise_runtime)

    client = VnstockClient(rate_limit_s=0.0)
    with pytest.raises(VnstockUnavailable):
        client.fetch_prices("VHM", days=30)


def test_fetch_prices_does_not_swallow_keyboard_interrupt(fake_vnstock_module):
    """Ctrl+C must propagate — wrapper must not hide user-initiated cancel."""

    def _raise_kbd(**_kwargs):
        raise KeyboardInterrupt

    fake_vnstock_module(_raise_kbd)

    client = VnstockClient(rate_limit_s=0.0)
    with pytest.raises(KeyboardInterrupt):
        client.fetch_prices("VHM", days=30)


def test_fetch_financials_merges_quarterly_frames(fake_vnstock_financial_module):
    class _Finance:
        def __init__(self, **_kwargs):
            pass

        def income_statement(self, **_kwargs):
            return pd.DataFrame(
                [
                    {"item_id": "revenue", "2026-Q1": 100.0, "2025-Q4": 90.0},
                    {"item_id": "net_profit", "2026-Q1": 12.0, "2025-Q4": 10.0},
                    {"item_id": "cost_of_goods_sold", "2026-Q1": 70.0, "2025-Q4": 65.0},
                    {"item_id": "eps", "2026-Q1": 1200.0, "2025-Q4": 1000.0},
                ]
            )

        def balance_sheet(self, **_kwargs):
            return pd.DataFrame(
                [
                    {"item_id": "total_assets", "2026-Q1": 500.0, "2025-Q4": 480.0},
                    {"item_id": "equity", "2026-Q1": 200.0, "2025-Q4": 190.0},
                    {"item_id": "total_liabilities", "2026-Q1": 300.0, "2025-Q4": 290.0},
                    {"item_id": "current_assets", "2026-Q1": 150.0, "2025-Q4": 145.0},
                    {"item_id": "current_liabilities", "2026-Q1": 80.0, "2025-Q4": 75.0},
                    {"item_id": "inventory", "2026-Q1": 40.0, "2025-Q4": 38.0},
                    {"item_id": "book_value_per_share", "2026-Q1": 20_000.0, "2025-Q4": 19_000.0},
                    {"item_id": "shares_outstanding", "2026-Q1": 1_000_000, "2025-Q4": 1_000_000},
                    {"item_id": "buyer_prepayments", "2026-Q1": 30.0, "2025-Q4": 25.0},
                ]
            )

        def cash_flow(self, **_kwargs):
            return pd.DataFrame(
                [
                    {"item_id": "operating_cash_flow", "2026-Q1": 20.0, "2025-Q4": 18.0},
                ]
            )

        def ratio(self, **_kwargs):
            return pd.DataFrame()

    fake_vnstock_financial_module(_Finance)

    rows = VnstockClient(rate_limit_s=0.0).fetch_financials("VHM")

    assert rows[0]["ticker"] == "VHM"
    assert rows[0]["period"] == "2026Q1"
    # Phase 22 — multi-source merge: this mock is shared by both VCI + KBS calls,
    # so VCI (no scaling, raw VND) populates first; KBS would scale but fields
    # are already non-null → no override. Values stay at raw VCI level.
    assert rows[0]["revenue"] == 100
    assert rows[0]["net_income"] == 12
    assert rows[0]["total_equity"] == 200
    assert rows[0]["total_debt"] == 300
    assert rows[0]["operating_cash_flow"] == 20
    assert rows[0]["bvps"] == 20_000  # per-share — not scaled anyway
    assert rows[0]["advances"] == 30
    assert len(rows) == 2


def test_stub_flag_short_circuits_both_fetch_paths(monkeypatch):
    """Phase 19 — VNSTOCK_CLIENT_STUB=true must skip lazy-import + return empty."""
    from app.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("VNSTOCK_CLIENT_STUB", "true")
    try:
        client = VnstockClient(rate_limit_s=0.0)
        assert client.fetch_prices("VHM", days=30) == []
        assert client.fetch_financials("VHM") == []
    finally:
        get_settings.cache_clear()


def test_kbs_balance_sheet_strips_prefix_and_skips_nan_header(fake_vnstock_financial_module):
    """Phase 21 — KBS item_ids dùng prefix `n_N.`, `a.`/`b.`/`c.`/`d.`, và có header NaN.

    Parser phải:
    (a) Strip prefix `n_1.`/`c.`/`d.` rồi mới match alias.
    (b) Skip NaN value để không overwrite giá trị real ở row sau.
    (c) KHÔNG match grand-total row `total_owners_equity_and_liabilities` vào total_equity.
    """
    import math

    class _Finance:
        def __init__(self, **_kwargs):
            pass

        def income_statement(self, **_kwargs):
            return pd.DataFrame(
                [
                    {"item": "1. Doanh thu", "item_id": "n_1.revenue", "2026-Q1": 1700.0},
                    {"item": "4. Cost of goods", "item_id": "n_4.cost_of_goods_sold", "2026-Q1": 1200.0},
                    {"item": "18. Net profit", "item_id": "n_18.net_profit_after_tax", "2026-Q1": 250.0},
                    {"item": "19. EPS", "item_id": "n_19.earnings_per_share_vnd", "2026-Q1": 1500.0},
                ]
            )

        def balance_sheet(self, **_kwargs):
            return pd.DataFrame(
                [
                    # Header row — value NaN, must not overwrite real total_assets
                    {"item": "TÀI SẢN", "item_id": "assets", "2026-Q1": math.nan},
                    {"item": "A. Tài sản ngắn hạn", "item_id": "a.short_term_assets", "2026-Q1": 19000.0},
                    {"item": "n_1. Inventories", "item_id": "n_1.inventories", "2026-Q1": 4000.0},
                    {"item": "TỔNG CỘNG TÀI SẢN", "item_id": "total_assets", "2026-Q1": 26500.0},
                    # Header (NaN) — must not overwrite
                    {"item": "NGUỒN VỐN", "item_id": "owners_equity", "2026-Q1": math.nan},
                    {"item": "C. Nợ phải trả", "item_id": "c.liabilities", "2026-Q1": 11700.0},
                    {"item": "D. Vốn chủ sở hữu", "item_id": "d.owners_equity", "2026-Q1": 14800.0},
                    # Grand total — must NOT match total_equity even though string contains "owners_equity"
                    {
                        "item": "TỔNG CỘNG NGUỒN VỐN",
                        "item_id": "total_owners_equity_and_liabilities",
                        "2026-Q1": 26500.0,
                    },
                ]
            )

        def cash_flow(self, **_kwargs):
            return pd.DataFrame(
                [{"item": "OCF", "item_id": "net_cash_flow_from_operating_activities", "2026-Q1": 320.0}]
            )

        def ratio(self, **_kwargs):
            return pd.DataFrame()

    fake_vnstock_financial_module(_Finance)
    rows = VnstockClient(rate_limit_s=0.0).fetch_financials("NLG")

    assert len(rows) == 1
    row = rows[0]
    assert row["period"] == "2026Q1"
    # Phase 22: shared mock — VCI runs first (no scaling), wins; KBS scaling no-op
    # because VCI already populated. Values stay at raw mock level.
    assert row["revenue"] == 1700, "n_1.revenue mapped"
    assert row["cogs"] == 1200
    assert row["net_income"] == 250
    assert row["eps"] == 1500
    assert row["inventory"] == 4000
    assert row["total_debt"] == 11700, "c.liabilities → total_debt (liabilities alias)"
    assert row["total_equity"] == 14800, "d.owners_equity → total_equity"
    assert row["total_assets"] == 26500, "header NaN must not overwrite real total_assets"
    # Grand total NOT polluting total_equity (would be 26500 if substring leaked)
    assert row["total_equity"] != 26500, "grand-total row must not match total_equity"
    assert row["operating_cash_flow"] == 320


def test_kbs_period_suffix_prefers_base_period(fake_vnstock_financial_module):
    """Phase 21 — KBS columns `2025-Q4_1` (restated) + `2025-Q4` (original) collide on
    `2025Q4` key. Parser must prefer base period and drop suffix (preserve original report)."""

    class _Finance:
        def __init__(self, **_kwargs):
            pass

        def income_statement(self, **_kwargs):
            return pd.DataFrame(
                [
                    # `_1` column appears first — base column last. Without preference rule,
                    # last-wins gives 90 (base). With proper rule, also gives 90 but explicit.
                    {"item_id": "n_1.revenue", "2026-Q1": 100, "2025-Q4_1": 95, "2025-Q4": 90, "2025-Q3": 85},
                ]
            )

        def balance_sheet(self, **_kwargs):
            return pd.DataFrame()

        def cash_flow(self, **_kwargs):
            return pd.DataFrame()

        def ratio(self, **_kwargs):
            return pd.DataFrame()

    fake_vnstock_financial_module(_Finance)
    rows = VnstockClient(rate_limit_s=0.0).fetch_financials("NLG")

    by_period = {r["period"]: r for r in rows}
    assert "2025Q4" in by_period
    # Base period preferred (90) wins via VCI first call; KBS scaling no-op.
    assert by_period["2025Q4"]["revenue"] == 90, "base period (2025-Q4) must override `_1` suffix"


def test_fetch_financials_merges_multiple_sources(fake_vnstock_financial_module):
    """Phase 21 — multi-source merge: VCI sparse + KBS complementary → all fields populated.

    VCI returns revenue + total_assets but no net_income/eps/OCF. KBS provides
    net_income + eps + OCF. Final merged row must contain BOTH sets, with VCI
    taking precedence on overlapping fields.
    """
    call_log: list[str] = []

    class _MultiSourceFinance:
        def __init__(self, source: str, **_kwargs) -> None:
            self._source = source
            call_log.append(source)

        def income_statement(self, **_kwargs):
            if self._source == "VCI":
                # VCI returns ONLY revenue (sparse) — net_income/eps absent
                return pd.DataFrame(
                    [{"item_id": "revenue", "2026-Q1": 100.0}]
                )
            # KBS provides net_income + eps
            return pd.DataFrame(
                [
                    {"item_id": "n_1.revenue", "2026-Q1": 105.0},  # should LOSE to VCI 100.0
                    {"item_id": "n_18.net_profit_after_tax", "2026-Q1": 12.0},
                    {"item_id": "n_19.earnings_per_share_vnd", "2026-Q1": 1500.0},
                ]
            )

        def balance_sheet(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame(
                    [{"item_id": "total_assets", "2026-Q1": 500.0}]  # VCI has total_assets
                )
            return pd.DataFrame(
                [
                    {"item_id": "total_assets", "2026-Q1": 510.0},  # KBS overlaps — VCI wins
                    {"item_id": "c.liabilities", "2026-Q1": 300.0},  # KBS-only field
                ]
            )

        def cash_flow(self, **_kwargs):
            if self._source == "VCI":
                return pd.DataFrame()
            return pd.DataFrame(
                [{"item_id": "net_cash_flows_from_operating_activities", "2026-Q1": 20.0}]
            )

        def ratio(self, **_kwargs):
            return pd.DataFrame()

    fake_vnstock_financial_module(_MultiSourceFinance)

    rows = VnstockClient(rate_limit_s=0.0).fetch_financials("VHM")
    assert call_log == ["VCI", "KBS"], "both sources must be queried sequentially"

    assert len(rows) == 1
    row = rows[0]
    assert row["period"] == "2026Q1"
    # Phase 22 — source-aware scaling: VCI = raw VND (no scaling), KBS = ngàn đồng (×1000).
    # VCI wins on overlapping fields, stored as raw VCI value.
    assert row["revenue"] == 100, "VCI revenue (raw, 100) wins over KBS (105×1000=105000)"
    assert row["total_assets"] == 500, "VCI total_assets (raw 500) wins over KBS"
    # KBS fills gaps where VCI returned nothing — KBS values scaled ×1000.
    assert row["net_income"] == 12_000, "KBS fills net_income (12 ngàn đồng → 12000 VND)"
    assert row["eps"] == 1500, "KBS fills eps — per-share VND, NOT scaled"
    assert row["operating_cash_flow"] == 20_000, "KBS fills OCF (20 → 20000)"
    assert row["total_debt"] == 300_000, "KBS-only field (c.liabilities → total_debt) scaled"


def test_fetch_financials_falls_back_to_kbs_when_vci_raises(fake_vnstock_financial_module):
    """Phase 21 — when VCI raises (e.g. quota burnt), KBS should still be tried."""

    class _Finance:
        def __init__(self, source: str, **_kwargs) -> None:
            self._source = source

        def income_statement(self, **_kwargs):
            if self._source == "VCI":
                raise SystemExit("quota")
            return pd.DataFrame(
                [{"item_id": "n_1.revenue", "2026-Q1": 200.0}]
            )

        def balance_sheet(self, **_kwargs):
            return pd.DataFrame(
                [{"item_id": "total_assets", "2026-Q1": 800.0}]
            ) if self._source == "KBS" else pd.DataFrame()

        def cash_flow(self, **_kwargs):
            return pd.DataFrame()

        def ratio(self, **_kwargs):
            return pd.DataFrame()

    fake_vnstock_financial_module(_Finance)

    rows = VnstockClient(rate_limit_s=0.0).fetch_financials("DXG")
    assert len(rows) == 1
    # KBS-only result (VCI raised), values scaled ×1000.
    assert rows[0]["revenue"] == 200_000
    assert rows[0]["total_assets"] == 800_000


def test_fetch_financials_converts_systemexit_to_vnstock_unavailable(fake_vnstock_financial_module):
    class _Finance:
        def __init__(self, **_kwargs):
            pass

        def income_statement(self, **_kwargs):
            raise SystemExit("quota")

    fake_vnstock_financial_module(_Finance)

    with pytest.raises(VnstockUnavailable) as exc_info:
        VnstockClient(rate_limit_s=0.0).fetch_financials("VHM")
    assert "VHM" in str(exc_info.value)
