"""Baseline price engine — naive trend extrapolation.

target_price_3m = current_price × (1 + trend_pct)
trend_pct = avg(T07 1M return, T08 3M return, T09 6M return) clamp ±50%

upside_pct = (target - current) / current × 100
target_date = run_at + 90 days

Khi thiếu return features → fallback trend_pct = 0 (current → target = current).
"""

from datetime import date, timedelta

from app.engines.base import PriceEngine, PriceResult


def _avg(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


class PriceBaselineEngine(PriceEngine):
    """Average T07/T08/T09 returns → 3M target. NaN/missing → 0."""

    def __init__(self, today: date | None = None) -> None:
        self.today = today or date.today()

    def predict(
        self,
        ticker: str,
        prices: list[float],
        features: dict[str, float],
    ) -> PriceResult:
        if not prices:
            raise ValueError(f"price_baseline: prices empty cho {ticker}")
        current_price = float(prices[-1])
        if current_price <= 0:
            raise ValueError(f"price_baseline: current_price={current_price} cho {ticker}")

        returns: list[float] = []
        for fid in ("T07", "T08", "T09"):
            v = features.get(fid)
            if v is not None:
                # Constants/features.py uses decimal convention (0.15 = 15%)
                returns.append(float(v))

        trend_pct = _clamp(_avg(returns), -0.5, 0.5)
        target_price = round(current_price * (1.0 + trend_pct), 2)
        upside_pct = round((target_price - current_price) / current_price * 100.0, 2)
        target_date = (self.today + timedelta(days=90)).isoformat()

        return PriceResult(
            target_price_3m=target_price,
            target_date=target_date,
            upside_pct=upside_pct,
        )
