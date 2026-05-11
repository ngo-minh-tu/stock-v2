"""4-round filter pipeline — SRS f01 Step 3-6.

Round 1: Red Flags (D/E≥4, audit qualified, suspended/delisted, newly listed)
Round 2: Penny price (close < 15.000 VNĐ — close stored in raw đồng)
Round 3: Liquidity (avg vol 20D < 300.000 cp/phiên)
Round 4: Data completeness (≥ 4Q financials AND ≥ 6M price history)

Output: list ExcludedRecord (ticker, round, code, reason text). Pass-through tickers
return riêng để pipeline sau xài.

Filter thresholds:
- D/E ≥ 4
- close < 15_000 VNĐ
- avg_volume_20d < 300_000
- min_quarters = 4, min_price_days = 126 (≈ 6 trading months)
"""

from dataclasses import dataclass

from app.constants import reason_codes as rc
from app.models.financial import FinancialReport
from app.models.stock import Stock, StockPrice

PRICE_FLOOR = 15_000.0
LIQUIDITY_FLOOR = 300_000
MIN_QUARTERS = 4
MIN_PRICE_DAYS = 126
DE_RED_FLAG = 4.0


@dataclass(frozen=True, slots=True)
class ExcludedRecord:
    ticker: str
    excluded_round: int
    reason_code: str
    reason: str


@dataclass(slots=True)
class FilterResult:
    kept: list[str]
    excluded: list[ExcludedRecord]
    after_round_1: int
    after_round_2: int
    after_round_3: int
    after_round_4: int


@dataclass(frozen=True, slots=True)
class StockData:
    """Bundle dữ liệu raw để filter — caller load từ DB rồi truyền vào."""

    stock: Stock
    financials: list[FinancialReport]  # latest first
    prices: list[StockPrice]  # oldest → newest


def _round1_red_flags(d: StockData) -> ExcludedRecord | None:
    s = d.stock
    if s.status in {"DELISTED", "SUSPENDED"}:
        return ExcludedRecord(
            ticker=s.ticker,
            excluded_round=1,
            reason_code=rc.LEGAL_BLOCK,
            reason=f"Trạng thái {s.status}",
        )
    latest = d.financials[0] if d.financials else None
    if latest and latest.audit_opinion and latest.audit_opinion.upper() in {"QUALIFIED", "ADVERSE", "DISCLAIMER"}:
        return ExcludedRecord(
            ticker=s.ticker,
            excluded_round=1,
            reason_code=rc.LEGAL_BLOCK,
            reason=f"Kiểm toán {latest.audit_opinion}",
        )
    if latest and latest.total_equity and float(latest.total_equity) > 0 and latest.total_debt is not None:
        de = float(latest.total_debt) / float(latest.total_equity)
        if de >= DE_RED_FLAG:
            return ExcludedRecord(
                ticker=s.ticker,
                excluded_round=1,
                reason_code=rc.HIGH_DE,
                reason=f"D/E = {de:.1f} ≥ {DE_RED_FLAG:.0f}",
            )
    if s.newly_listed and len(d.financials) < MIN_QUARTERS:
        return ExcludedRecord(
            ticker=s.ticker,
            excluded_round=1,
            reason_code=rc.NEWLY_LISTED,
            reason=f"Mới niêm yết, {len(d.financials)}Q < {MIN_QUARTERS}Q BCTC",
        )
    return None


def _round2_price(d: StockData) -> ExcludedRecord | None:
    if not d.prices:
        return None  # round 4 sẽ catch
    last_close = d.prices[-1].close
    if last_close is None:
        return None
    close = float(last_close)
    if close < PRICE_FLOOR:
        return ExcludedRecord(
            ticker=d.stock.ticker,
            excluded_round=2,
            reason_code=rc.PENNY_PRICE,
            reason=f"Giá {close / 1000:.1f}k < {PRICE_FLOOR / 1000:.0f}k",
        )
    return None


def _round3_liquidity(d: StockData) -> ExcludedRecord | None:
    volumes = [int(p.volume) for p in d.prices[-20:] if p.volume is not None]
    if len(volumes) < 20:
        return None  # round 4 catch insufficient data
    avg = sum(volumes) / len(volumes)
    if avg < LIQUIDITY_FLOOR:
        return ExcludedRecord(
            ticker=d.stock.ticker,
            excluded_round=3,
            reason_code=rc.LOW_LIQUIDITY,
            reason=f"KLGD TB 20p {avg / 1000:.0f}K cp/phiên < {LIQUIDITY_FLOOR // 1000}K",
        )
    return None


def _round4_data_completeness(d: StockData) -> ExcludedRecord | None:
    if len(d.financials) < MIN_QUARTERS:
        return ExcludedRecord(
            ticker=d.stock.ticker,
            excluded_round=4,
            reason_code=rc.INSUFFICIENT_DATA,
            reason=f"{len(d.financials)}Q < {MIN_QUARTERS}Q BCTC",
        )
    if len(d.prices) < MIN_PRICE_DAYS:
        return ExcludedRecord(
            ticker=d.stock.ticker,
            excluded_round=4,
            reason_code=rc.INSUFFICIENT_DATA,
            reason=f"Lịch sử giá {len(d.prices)} phiên < {MIN_PRICE_DAYS}",
        )
    return None


_ROUNDS = (
    (1, _round1_red_flags),
    (2, _round2_price),
    (3, _round3_liquidity),
    (4, _round4_data_completeness),
)


def run_filters(inputs: list[StockData]) -> FilterResult:
    """Run 4 rounds; first-fail wins, tickers chỉ excluded một lần."""
    excluded: list[ExcludedRecord] = []
    survivors: dict[str, StockData] = {d.stock.ticker: d for d in inputs}

    counts = {1: len(survivors), 2: 0, 3: 0, 4: 0}
    for round_no, fn in _ROUNDS:
        next_round: dict[str, StockData] = {}
        for ticker, data in survivors.items():
            rec = fn(data)
            if rec is not None:
                excluded.append(rec)
            else:
                next_round[ticker] = data
        survivors = next_round
        counts[round_no] = len(survivors)
    return FilterResult(
        kept=list(survivors.keys()),
        excluded=excluded,
        after_round_1=counts[1],
        after_round_2=counts[2],
        after_round_3=counts[3],
        after_round_4=counts[4],
    )
