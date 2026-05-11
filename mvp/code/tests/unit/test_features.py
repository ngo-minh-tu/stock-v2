"""Feature engineering — calc 38 features + raw indicators + missing data rules."""

from datetime import date, timedelta

import pytest
from app.constants.features import FEATURE_IDS
from app.engines.scoring_baseline import ScoringBaselineEngine
from app.models.financial import FinancialReport
from app.models.stock import StockPrice
from app.services.feature_service import FeatureService


def _make_prices(days: int = 200, start_price: float = 50_000.0, trend: float = 0.0005) -> list[StockPrice]:
    """Synthetic OHLCV: start_price compounded daily by `trend` (e.g. 0.05% / day)."""
    base = date(2026, 5, 1)
    out: list[StockPrice] = []
    p = start_price
    for i in range(days):
        out.append(
            StockPrice(
                ticker="VHM",
                date=base - timedelta(days=days - 1 - i),
                open=p,
                high=p * 1.01,
                low=p * 0.99,
                close=p,
                volume=1_500_000,
            )
        )
        p = p * (1.0 + trend)
    return out


def _make_financials() -> list[FinancialReport]:
    """4 quarters latest first; YoY growth ≈ 20% (2025Q4 vs 2024Q4)."""
    rows: list[FinancialReport] = []
    quarters = [(2025, 4), (2025, 3), (2025, 2), (2025, 1), (2024, 4)]
    for i, (year, q) in enumerate(quarters):
        scale = 1.0 - i * 0.05  # most recent biggest
        rows.append(
            FinancialReport(
                ticker="VHM",
                period=f"{year}Q{q}",
                year=year,
                quarter=q,
                revenue=20e9 * scale,
                net_income=2e9 * scale,
                total_assets=80e9,
                total_equity=40e9,
                total_debt=30e9,
                current_assets=25e9,
                current_liabilities=15e9,
                inventory=15e9,
                cogs=12e9,
                operating_cash_flow=3e9,
                eps=2500.0 * scale,
                bvps=20000.0,
                advances=2e9 * scale,
                shares_outstanding=1_000_000_000,
                audit_opinion="UNQUALIFIED",
            )
        )
    return rows


@pytest.fixture
def service() -> FeatureService:
    return FeatureService()


def test_full_feature_set_present(service):
    bundle = service.compute(
        ticker="VHM",
        financials=_make_financials(),
        prices=_make_prices(),
        macro={"M01": 0.06, "M02": 0.10, "M03": 0.04, "M04": 3e9, "M05": 1100.0},
    )
    # Should produce ≥ 35 of 38 features (R01/R02 may be sector-impute defaults; that's fine, they're set)
    assert len(bundle.features) == 38
    assert set(bundle.features.keys()) == set(FEATURE_IDS)
    assert bundle.insufficient_data is False


def test_no_features_outside_whitelist(service):
    """SRS f02 AC-02-02 + GUARD-01."""
    bundle = service.compute(
        ticker="VHM",
        financials=_make_financials(),
        prices=_make_prices(),
        macro={},
    )
    extra = set(bundle.features.keys()) - set(FEATURE_IDS)
    assert not extra


def test_t01_ma_trend_in_range(service):
    bundle = service.compute(
        ticker="VHM",
        financials=_make_financials(),
        prices=_make_prices(),
        macro={"M05": 1100.0},
    )
    assert 0 <= bundle.features["T01"] <= 100  # AC-02-06


def test_t05_bollinger_in_range(service):
    bundle = service.compute(
        ticker="VHM",
        financials=_make_financials(),
        prices=_make_prices(),
        macro={"M05": 1100.0},
    )
    assert 0 <= bundle.features["T05"] <= 1.0  # AC-02-07


def test_t03_rsi_in_range(service):
    bundle = service.compute(
        ticker="VHM",
        financials=_make_financials(),
        prices=_make_prices(),
        macro={"M05": 1100.0},
    )
    assert 0 <= bundle.features["T03"] <= 100


def test_insufficient_data_when_required_missing(service):
    """Thiếu T01-T06 + M05 → INSUFFICIENT_FEATURES warning."""
    bundle = service.compute(
        ticker="VHM",
        financials=[],
        prices=[],
        macro={},
    )
    assert bundle.insufficient_data is True
    assert "INSUFFICIENT_FEATURES" in bundle.warnings


def test_negative_ocf_warning(service):
    """F10 < 0 → bundle.warnings có NEGATIVE_OCF."""
    fins = _make_financials()
    fins[0].operating_cash_flow = -5e9
    bundle = service.compute(
        ticker="VHM",
        financials=fins,
        prices=_make_prices(),
        macro={"M05": 1100.0},
    )
    assert "NEGATIVE_OCF" in bundle.warnings
    assert bundle.features["F10"] < 0


def test_raw_indicators_populated(service):
    bundle = service.compute(
        ticker="VHM",
        financials=_make_financials(),
        prices=_make_prices(),
        macro={"M05": 1100.0},
    )
    ri = bundle.raw_indicators
    assert "rsi" in ri
    assert "sma20" in ri
    assert "bb_upper" in ri
    assert "bb_lower" in ri


def test_feature_dict_works_with_scoring_engine(service):
    """End-to-end: features → ScoringBaselineEngine → ai_score."""
    bundle = service.compute(
        ticker="VHM",
        financials=_make_financials(),
        prices=_make_prices(trend=0.001),  # trend mạnh hơn cho good technical
        macro={"M01": 0.05, "M02": 0.12, "M03": 0.03, "M04": 4e9, "M05": 1300.0},
        legal_risk=2.0,
        sentiment_avg=0.4,
        news_count_30d=15,
    )
    engine = ScoringBaselineEngine()
    res = engine.score(bundle.features)
    assert 0 <= res.ai_score <= 100
    assert res.recommendation in {"MUA", "GIU", "BAN"}
