"""4-round filter pipeline — SRS f01 Step 3-6."""

from datetime import date, timedelta

import pytest
from app.constants import reason_codes as rc
from app.models.financial import FinancialReport
from app.models.stock import Stock, StockPrice
from app.services.filter_service import StockData, run_filters


def _stock(ticker: str = "VHM", *, status: str = "ACTIVE", newly_listed: bool = False) -> Stock:
    return Stock(ticker=ticker, name=ticker, exchange="HOSE", sector="Real Estate", status=status, newly_listed=newly_listed)


def _financials(
    ticker: str = "VHM",
    *,
    quarters: int = 4,
    debt: float = 5e9,
    equity: float = 10e9,
    audit: str = "UNQUALIFIED",
) -> list[FinancialReport]:
    rows: list[FinancialReport] = []
    for i in range(quarters):
        rows.append(
            FinancialReport(
                ticker=ticker,
                period=f"2025Q{4 - i}" if i < 4 else f"2024Q{8 - i}",
                year=2025 if i < 4 else 2024,
                quarter=4 - i if i < 4 else 8 - i,
                revenue=20e9,
                net_income=2e9,
                total_assets=50e9,
                total_equity=equity,
                total_debt=debt,
                current_assets=15e9,
                current_liabilities=10e9,
                inventory=5e9,
                cogs=15e9,
                operating_cash_flow=3e9,
                eps=2500,
                bvps=20000,
                advances=2e9,
                shares_outstanding=1_000_000,
                audit_opinion=audit,
            )
        )
    return rows


def _prices(
    ticker: str = "VHM",
    *,
    days: int = 200,
    close: float = 50_000.0,
    volume: int = 1_000_000,
) -> list[StockPrice]:
    base = date(2026, 5, 1)
    return [
        StockPrice(
            ticker=ticker,
            date=base - timedelta(days=days - 1 - i),
            open=close,
            high=close,
            low=close,
            close=close,
            volume=volume,
        )
        for i in range(days)
    ]


@pytest.fixture
def healthy() -> StockData:
    return StockData(stock=_stock(), financials=_financials(), prices=_prices())


def test_healthy_stock_passes_all_rounds(healthy):
    res = run_filters([healthy])
    assert res.kept == ["VHM"]
    assert res.excluded == []
    assert res.after_round_4 == 1


# ----- Round 1: Red Flags ----------------------------------------------------

def test_round1_high_de():
    data = StockData(stock=_stock("BAD"), financials=_financials("BAD", debt=50e9, equity=10e9), prices=_prices("BAD"))
    res = run_filters([data])
    assert res.kept == []
    assert res.excluded[0].excluded_round == 1
    assert res.excluded[0].reason_code == rc.HIGH_DE


def test_round1_audit_qualified():
    data = StockData(
        stock=_stock("AUD"),
        financials=_financials("AUD", audit="QUALIFIED"),
        prices=_prices("AUD"),
    )
    res = run_filters([data])
    assert res.excluded[0].reason_code == rc.LEGAL_BLOCK


def test_round1_delisted():
    data = StockData(stock=_stock("DEL", status="DELISTED"), financials=_financials("DEL"), prices=_prices("DEL"))
    res = run_filters([data])
    assert res.excluded[0].excluded_round == 1
    assert res.excluded[0].reason_code == rc.LEGAL_BLOCK


def test_round1_newly_listed():
    data = StockData(
        stock=_stock("NEW", newly_listed=True),
        financials=_financials("NEW", quarters=2),
        prices=_prices("NEW"),
    )
    res = run_filters([data])
    assert res.excluded[0].reason_code == rc.NEWLY_LISTED


# ----- Round 2: Penny price --------------------------------------------------

def test_round2_penny_price():
    data = StockData(stock=_stock("PEN"), financials=_financials("PEN"), prices=_prices("PEN", close=10_000.0))
    res = run_filters([data])
    assert res.excluded[0].excluded_round == 2
    assert res.excluded[0].reason_code == rc.PENNY_PRICE


def test_round2_at_floor_passes():
    """Boundary: close = 15.000 → KHÔNG bị filter (strict <)."""
    data = StockData(stock=_stock("FLR"), financials=_financials("FLR"), prices=_prices("FLR", close=15_000.0))
    res = run_filters([data])
    assert res.kept == ["FLR"]


# ----- Round 3: Liquidity ----------------------------------------------------

def test_round3_low_liquidity():
    data = StockData(stock=_stock("LOW"), financials=_financials("LOW"), prices=_prices("LOW", volume=200_000))
    res = run_filters([data])
    assert res.excluded[0].excluded_round == 3
    assert res.excluded[0].reason_code == rc.LOW_LIQUIDITY


# ----- Round 4: Data completeness --------------------------------------------

def test_round4_missing_quarters():
    data = StockData(stock=_stock("MQR"), financials=_financials("MQR", quarters=2), prices=_prices("MQR"))
    res = run_filters([data])
    assert res.excluded[0].excluded_round == 4
    assert res.excluded[0].reason_code == rc.INSUFFICIENT_DATA


def test_round4_short_price_history():
    data = StockData(stock=_stock("SHP"), financials=_financials("SHP"), prices=_prices("SHP", days=80))
    res = run_filters([data])
    assert res.excluded[0].excluded_round == 4


# ----- Pipeline counts -------------------------------------------------------

def test_after_round_counts_decreasing(healthy):
    bad_round1 = StockData(
        stock=_stock("HDE"),
        financials=_financials("HDE", debt=50e9, equity=10e9),
        prices=_prices("HDE"),
    )
    penny = StockData(stock=_stock("PNY"), financials=_financials("PNY"), prices=_prices("PNY", close=10_000.0))
    res = run_filters([healthy, bad_round1, penny])
    # 3 → after r1: 2 (HDE excluded) → after r2: 1 (PNY excluded)
    assert res.after_round_1 == 2
    assert res.after_round_2 == 1
    assert res.after_round_3 == 1
    assert res.after_round_4 == 1
    assert res.kept == ["VHM"]


def test_total_input_equals_after_round_1_plus_excluded_round_1(healthy):
    """SRS f01 AC-01-03."""
    bad = StockData(
        stock=_stock("BD2"),
        financials=_financials("BD2", debt=50e9, equity=10e9),
        prices=_prices("BD2"),
    )
    res = run_filters([healthy, bad])
    excluded_r1 = sum(1 for e in res.excluded if e.excluded_round == 1)
    total_input = 2
    assert total_input == res.after_round_1 + excluded_r1


def test_excluded_codes_subset_of_canonical():
    """GUARD: all reason_codes phải nằm trong FILTER_EXCLUSION_CODES."""
    bad_cases = [
        StockData(stock=_stock("A"), financials=_financials("A", debt=50e9, equity=10e9), prices=_prices("A")),
        StockData(stock=_stock("B"), financials=_financials("B"), prices=_prices("B", close=10_000.0)),
        StockData(stock=_stock("C"), financials=_financials("C"), prices=_prices("C", volume=100_000)),
        StockData(stock=_stock("D"), financials=_financials("D", quarters=1), prices=_prices("D")),
    ]
    res = run_filters(bad_cases)
    for rec in res.excluded:
        assert rec.reason_code in rc.FILTER_EXCLUSION_CODES
