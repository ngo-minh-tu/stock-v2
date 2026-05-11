"""vnstock wrapper với rate limit 0.5s — TAD g04 §3.

Thiết kế:
- Lazy-import vnstock library (test có thể monkeypatch trước import).
- `fetch_prices(ticker, days)` + `fetch_financials(ticker)` raise `VnstockUnavailable` khi mạng/API lỗi.
- Rate limit shared cross-instance qua `_RateGate` module-level (mọi caller dùng cùng singleton).
- KHÔNG retry trong wrapper — caller (refresh_service) decide retry policy.
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import date, datetime, timedelta
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


class VnstockUnavailable(Exception):
    """Raised khi vnstock library lỗi hoặc network down."""


class _RateGate:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last_call_ts: float = 0.0

    def wait(self, min_interval_s: float) -> None:
        with self._lock:
            elapsed = time.monotonic() - self._last_call_ts
            if elapsed < min_interval_s:
                time.sleep(min_interval_s - elapsed)
            self._last_call_ts = time.monotonic()


_gate = _RateGate()


class VnstockClient:
    """Stateless wrapper. Mỗi method gate qua `_gate.wait()` để bảo đảm 0.5s/call."""

    def __init__(self, *, rate_limit_s: float | None = None) -> None:
        s = get_settings()
        self._rate_limit_s = rate_limit_s if rate_limit_s is not None else s.vnstock_rate_limit_s

    def _gate_wait(self) -> None:
        _gate.wait(self._rate_limit_s)

    def fetch_prices(self, ticker: str, *, days: int = 365) -> list[dict[str, Any]]:
        """OHLCV daily history. Return list of {date, open, high, low, close, volume}.

        Lỗi network/library → raise `VnstockUnavailable`. Empty result (mã mới list) → list rỗng.
        """
        self._gate_wait()
        try:
            from vnstock import Vnstock  # lazy import

            stock = Vnstock().stock(symbol=ticker, source="VCI")
            end = date.today()
            start = end - timedelta(days=days)
            df = stock.quote.history(start=start.isoformat(), end=end.isoformat(), interval="1D")
        except Exception as e:
            logger.warning("vnstock prices failed for %s: %s", ticker, e)
            raise VnstockUnavailable(f"prices fetch failed for {ticker}: {e}") from e

        rows: list[dict[str, Any]] = []
        if df is None or len(df) == 0:
            return rows
        for _, r in df.iterrows():
            rows.append(
                {
                    "ticker": ticker,
                    "date": _to_date(r.get("time") or r.get("date")),
                    "open": _to_float(r.get("open")),
                    "high": _to_float(r.get("high")),
                    "low": _to_float(r.get("low")),
                    "close": _to_float(r.get("close")),
                    "volume": _to_int(r.get("volume")),
                }
            )
        return rows

    def fetch_financials(self, ticker: str) -> list[dict[str, Any]]:
        """Quarterly financial reports. Return list of dicts (period, year, quarter, fields...).

        MVP stub: vnstock financial API có nhiều biến thể — wrapper này keep skeleton, real
        binding implement khi có data thật. Hiện return list rỗng + log để refresh service không crash.
        """
        self._gate_wait()
        logger.info("fetch_financials stub for %s — returning empty (Phase 4+ wire real)", ticker)
        return []


def _to_date(v: Any) -> date | None:
    if v is None:
        return None
    if isinstance(v, date):
        return v
    if isinstance(v, datetime):
        return v.date()
    try:
        return datetime.fromisoformat(str(v)).date()
    except ValueError:
        return None


def _to_float(v: Any) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _to_int(v: Any) -> int | None:
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None
