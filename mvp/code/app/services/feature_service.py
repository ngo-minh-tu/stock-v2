"""Feature engineering — 38 scoring features + raw indicators.

SRS f02 (calculation rules + missing data) + TAD c02.

Convention: tất cả ratio features dùng DECIMAL (e.g. ROE=0.18 = 18%) để khớp
constants/features.py good/bad scale. Output decimal, frontend nhân ×100 khi
display nếu cần. SRS-02 "× 100" formula được hiểu là chuyển sang phần trăm cho
display, không phải normalization input — internal math giữ decimal cho stable.

Inputs:
- FinancialReport rows (≤4 quarters, latest first)
- StockPrice rows (≥120 daily bars khuyến nghị, oldest → newest)
- Macro dict {M01..M05: value}
- Sector medians dict (per-feature impute)

Output:
    FeatureBundle(features={F01..S03: float}, raw_indicators={...}, availability=int, warnings=[])
"""

from dataclasses import dataclass, field
from math import sqrt
from statistics import mean

from app.models.financial import FinancialReport
from app.models.stock import StockPrice

REQUIRED_FUNDAMENTAL_FEATURES = {"F05", "F06"}
REQUIRED_TECHNICAL_FEATURES = {"T01", "T02", "T03", "T04", "T05", "T06"}
REQUIRED_MACRO_FEATURES = {"M05"}


@dataclass(slots=True)
class FeatureBundle:
    features: dict[str, float] = field(default_factory=dict)
    raw_indicators: dict[str, float] = field(default_factory=dict)
    availability: int = 0
    warnings: list[str] = field(default_factory=list)
    insufficient_data: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_div(num: float | None, den: float | None) -> float | None:
    """Return float(num/den), or None nếu thiếu / chia 0. Coerce Decimal→float để engine dùng được."""
    if num is None or den is None:
        return None
    den_f = float(den)
    if den_f == 0:
        return None
    return float(num) / den_f


def _sma(values: list[float], window: int) -> float | None:
    if len(values) < window:
        return None
    return sum(values[-window:]) / window


def _ema(values: list[float], window: int) -> float | None:
    if len(values) < window:
        return None
    k = 2.0 / (window + 1)
    ema = sum(values[:window]) / window
    for v in values[window:]:
        ema = v * k + ema * (1 - k)
    return ema


def _rsi(prices: list[float], window: int = 14) -> float | None:
    if len(prices) <= window:
        return None
    gains: list[float] = []
    losses: list[float] = []
    for i in range(1, len(prices)):
        diff = prices[i] - prices[i - 1]
        gains.append(max(diff, 0.0))
        losses.append(max(-diff, 0.0))
    avg_gain = sum(gains[:window]) / window
    avg_loss = sum(losses[:window]) / window
    for i in range(window, len(gains)):
        avg_gain = (avg_gain * (window - 1) + gains[i]) / window
        avg_loss = (avg_loss * (window - 1) + losses[i]) / window
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - 100.0 / (1.0 + rs)


def _macd(prices: list[float]) -> tuple[float | None, float | None, float | None]:
    """Return (macd_line, signal_line, histogram). 12/26/9 standard."""
    ema12 = _ema(prices, 12)
    ema26 = _ema(prices, 26)
    if ema12 is None or ema26 is None:
        return None, None, None
    # Build full MACD series for signal line (need ≥9 macd points).
    macd_series: list[float] = []
    for n in range(26, len(prices) + 1):
        slice_ = prices[:n]
        e12 = _ema(slice_, 12)
        e26 = _ema(slice_, 26)
        if e12 is not None and e26 is not None:
            macd_series.append(e12 - e26)
    macd_line = macd_series[-1] if macd_series else (ema12 - ema26)
    signal_line = _ema(macd_series, 9) if len(macd_series) >= 9 else None
    histogram = (macd_line - signal_line) if signal_line is not None else None
    return macd_line, signal_line, histogram


def _bollinger(prices: list[float], window: int = 20, k: float = 2.0) -> tuple[float | None, float | None, float | None]:
    """Return (upper, lower, position 0..1)."""
    if len(prices) < window:
        return None, None, None
    last = prices[-window:]
    m = sum(last) / window
    var = sum((v - m) ** 2 for v in last) / window
    sd = sqrt(var)
    upper = m + k * sd
    lower = m - k * sd
    pos = 0.5 if upper == lower else (prices[-1] - lower) / (upper - lower)
    return upper, lower, max(0.0, min(1.0, pos))


def _support_resistance(prices: list[float], lookback: int = 60) -> tuple[float | None, float | None]:
    """Naive S/R = min/max trong lookback window."""
    if len(prices) < 2:
        return None, None
    window = prices[-lookback:] if len(prices) > lookback else prices[:]
    return min(window), max(window)


def _macd_signal_cross(prices: list[float]) -> bool:
    """True nếu MACD vừa cắt lên signal trong 5 phiên gần nhất."""
    if len(prices) < 35:
        return False
    histories: list[float] = []
    for n in range(35, len(prices) + 1):
        _, _, h = _macd(prices[:n])
        if h is not None:
            histories.append(h)
    if len(histories) < 6:
        return False
    recent = histories[-5:]
    prev = histories[-6]
    return prev <= 0 and any(h > 0 for h in recent)


# ---------------------------------------------------------------------------
# Feature service
# ---------------------------------------------------------------------------

class FeatureService:
    """Tính 38 features + raw indicators cho 1 ticker."""

    def __init__(self, sector_medians: dict[str, float] | None = None) -> None:
        self.sector_medians = sector_medians or {}

    def compute(
        self,
        ticker: str,
        financials: list[FinancialReport],
        prices: list[StockPrice],
        macro: dict[str, float],
        legal_risk: float = 3.0,
        land_bank_ha: float | None = None,
        project_count: float | None = None,
        sentiment_avg: float | None = None,
        news_count_30d: int = 0,
        insider_net: float = 0.0,
    ) -> FeatureBundle:
        bundle = FeatureBundle()
        f = bundle.features

        # ----- Fundamental F01-F16 -----
        if financials:
            latest = financials[0]
            prev = financials[1] if len(financials) > 1 else None
            close_now = float(prices[-1].close) if prices and prices[-1].close else None

            # F05 EPS REQUIRED
            if latest.eps is not None:
                f["F05"] = float(latest.eps)
            # F01 P/E
            if close_now is not None and latest.eps is not None and float(latest.eps) > 0:
                f["F01"] = close_now / float(latest.eps)
            elif close_now is not None and latest.eps is not None and float(latest.eps) <= 0:
                f["F01"] = 0.0  # treated as bad in normalize
            # F02 P/B
            if close_now is not None and latest.bvps and float(latest.bvps) > 0:
                f["F02"] = close_now / float(latest.bvps)
            # F03 ROE
            roe = _safe_div(latest.net_income, latest.total_equity)
            if roe is not None:
                f["F03"] = roe
            else:
                f["F03"] = 0.0
            # F04 ROA
            roa = _safe_div(latest.net_income, latest.total_assets)
            f["F04"] = roa if roa is not None else 0.0
            # F06 D/E REQUIRED
            de = _safe_div(latest.total_debt, latest.total_equity)
            if de is not None:
                f["F06"] = de
            # F07 Net Margin
            nm = _safe_div(latest.net_income, latest.revenue)
            f["F07"] = nm if nm is not None else 0.0
            # F08 Rev Growth YoY
            if prev and prev.revenue and float(prev.revenue) > 0 and latest.revenue is not None:
                f["F08"] = (float(latest.revenue) - float(prev.revenue)) / float(prev.revenue)
            else:
                f["F08"] = 0.0
            # F09 Profit Growth YoY
            if (
                prev
                and prev.net_income is not None
                and float(prev.net_income) != 0
                and latest.net_income is not None
            ):
                f["F09"] = (float(latest.net_income) - float(prev.net_income)) / abs(float(prev.net_income))
            else:
                f["F09"] = 0.0
            # F10 OCF (đơn vị tỷ — chia 1e9 nếu raw đồng)
            if latest.operating_cash_flow is not None:
                ocf_billion = float(latest.operating_cash_flow) / 1e9
                f["F10"] = ocf_billion
                if ocf_billion < 0:
                    bundle.warnings.append("NEGATIVE_OCF")
            else:
                f["F10"] = 0.0
            # F11 Current Ratio
            cr = _safe_div(latest.current_assets, latest.current_liabilities)
            f["F11"] = cr if cr is not None else 1.0
            # F12 Advances YoY change
            if prev and prev.advances and float(prev.advances) > 0 and latest.advances is not None:
                f["F12"] = (float(latest.advances) - float(prev.advances)) / float(prev.advances)
            else:
                f["F12"] = 0.0
            # F13 OCF/NI
            if (
                latest.operating_cash_flow is not None
                and latest.net_income is not None
                and float(latest.net_income) > 0
            ):
                f["F13"] = float(latest.operating_cash_flow) / float(latest.net_income)
            else:
                f["F13"] = 0.5
            # F14 Inv/TA
            inv_ta = _safe_div(latest.inventory, latest.total_assets)
            if inv_ta is not None:
                f["F14"] = inv_ta
            else:
                f["F14"] = self.sector_medians.get("F14", 0.30)
            # F15 Inv Turnover (COGS / inventory)
            inv_turn = _safe_div(latest.cogs, latest.inventory)
            if inv_turn is not None:
                f["F15"] = inv_turn
            else:
                f["F15"] = self.sector_medians.get("F15", 0.5)
            # F16 Inv vs Rev growth
            if prev and prev.inventory and float(prev.inventory) > 0 and latest.inventory is not None:
                inv_growth = (float(latest.inventory) - float(prev.inventory)) / float(prev.inventory)
                f["F16"] = inv_growth - f.get("F08", 0.0)
            else:
                f["F16"] = 0.0

        # ----- Technical T01-T09 -----
        closes = [float(p.close) for p in prices if p.close is not None]
        volumes = [int(p.volume) for p in prices if p.volume is not None]

        sma20 = _sma(closes, 20)
        sma50 = _sma(closes, 50)
        sma200 = _sma(closes, 200)
        ema12 = _ema(closes, 12)
        ema26 = _ema(closes, 26)
        macd_line, macd_signal, macd_hist = _macd(closes)
        bb_upper, bb_lower, bb_pos = _bollinger(closes)
        rsi14 = _rsi(closes, 14)
        support, resistance = _support_resistance(closes)

        if closes:
            last_price = closes[-1]
            if sma20 and sma50 and sma200:
                # T01 MA Trend Score
                f["T01"] = (33.0 if last_price > sma20 else 0.0) + (33.0 if last_price > sma50 else 0.0) + (34.0 if last_price > sma200 else 0.0)
            if ema12 and ema26 and ema26 != 0:
                f["T02"] = (ema12 - ema26) / ema26
            if rsi14 is not None:
                f["T03"] = rsi14
            if macd_hist is not None:
                f["T04"] = macd_hist
            if bb_pos is not None:
                f["T05"] = bb_pos
            if volumes and len(volumes) >= 20:
                f["T06"] = mean(volumes[-20:])
            # Returns 1M/3M/6M (≈21/63/126 trading days)
            for fid, lookback in (("T07", 21), ("T08", 63), ("T09", 126)):
                if len(closes) > lookback and closes[-lookback - 1] > 0:
                    f[fid] = (closes[-1] - closes[-lookback - 1]) / closes[-lookback - 1]
                else:
                    f[fid] = 0.0

        # ----- Macro M01-M05 -----
        for fid in ("M01", "M02", "M03", "M04", "M05"):
            if fid in macro:
                f[fid] = float(macro[fid])

        # ----- Real Estate R01-R05 -----
        if land_bank_ha is not None:
            f["R01"] = land_bank_ha
        else:
            f["R01"] = self.sector_medians.get("R01", 1000.0)
        if project_count is not None:
            f["R02"] = project_count
        else:
            f["R02"] = self.sector_medians.get("R02", 4.0)
        # R03 NAV/cp = BVPS × 1.2 (impute) or computed if available
        if financials and financials[0].bvps:
            f["R03"] = float(financials[0].bvps) * 1.2
        else:
            f["R03"] = self.sector_medians.get("R03", 25000.0)
        # R04 NAV Discount = (NAV - price) / NAV
        if "R03" in f and closes and f["R03"] > 0:
            f["R04"] = (f["R03"] - closes[-1]) / f["R03"]
        else:
            f["R04"] = 0.0
        f["R05"] = legal_risk

        # ----- Sentiment S01-S03 -----
        f["S01"] = sentiment_avg if sentiment_avg is not None else 0.0
        f["S02"] = float(news_count_30d)
        f["S03"] = insider_net

        # ----- Raw indicators (entry engine input) -----
        ri = bundle.raw_indicators
        if sma20:
            ri["sma20"] = sma20
        if sma50:
            ri["sma50"] = sma50
        if sma200:
            ri["sma200"] = sma200
        if ema12:
            ri["ema12"] = ema12
        if ema26:
            ri["ema26"] = ema26
        if bb_upper:
            ri["bb_upper"] = bb_upper
        if bb_lower:
            ri["bb_lower"] = bb_lower
        if macd_signal is not None:
            ri["macd_signal_line"] = macd_signal
        if macd_hist is not None:
            ri["macd_histogram"] = macd_hist
        if rsi14 is not None:
            ri["rsi"] = rsi14
        if support is not None:
            ri["support"] = support
        if resistance is not None:
            ri["resistance"] = resistance
        ri["macd_signal_cross"] = 1.0 if _macd_signal_cross(closes) else 0.0

        # ----- Availability + INSUFFICIENT_DATA gate -----
        bundle.availability = len(f)
        missing_required = (
            (REQUIRED_FUNDAMENTAL_FEATURES - f.keys())
            | (REQUIRED_TECHNICAL_FEATURES - f.keys())
            | (REQUIRED_MACRO_FEATURES - f.keys())
        )
        if missing_required:
            bundle.insufficient_data = True
            bundle.warnings.append("INSUFFICIENT_FEATURES")

        return bundle
