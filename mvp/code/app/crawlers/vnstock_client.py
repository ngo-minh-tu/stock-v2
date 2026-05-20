"""vnstock wrapper với configurable rate limit — TAD g04 §3.

Thiết kế:
- Lazy-import vnstock library (test có thể monkeypatch trước import).
- `fetch_prices(ticker, days)` + `fetch_financials(ticker)` raise `VnstockUnavailable` khi mạng/API lỗi.
- Rate limit shared cross-instance qua `_RateGate` module-level (mọi caller dùng cùng singleton).
- KHÔNG retry trong wrapper — caller (refresh_service) decide retry policy.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from datetime import date, datetime, timedelta
from typing import Any
from unicodedata import combining
from unicodedata import normalize as unicode_normalize

from app.config import get_settings

logger = logging.getLogger(__name__)

_FINANCIAL_FIELDS = {
    "revenue",
    "net_income",
    "total_assets",
    "total_equity",
    "total_debt",
    "current_assets",
    "current_liabilities",
    "inventory",
    "cogs",
    "operating_cash_flow",
    "eps",
    "bvps",
    "advances",
    "shares_outstanding",
    "audit_opinion",
}

_FIELD_ALIASES: dict[str, set[str]] = {
    "revenue": {
        "revenue",
        "net_revenue",
        "total_revenue",
        "sales",
        "doanh_thu",
        "doanh_thu_thuan",
        "doanh_thu_ban_hang",
    },
    "net_income": {
        "net_income",
        "net_profit",
        "profit_after_tax",
        "net_profit_after_tax",
        "earnings_after_tax",
        "loi_nhuan_sau_thue",
        "loi_nhuan_sau_thue_thu_nhap_doanh_nghiep",
        "lnst",
    },
    "total_assets": {"total_assets", "assets", "tong_tai_san"},
    "total_equity": {
        "total_equity",
        "equity",
        "shareholders_equity",
        "owners_equity",
        "von_chu_so_huu",
        "owner_equity",
    },
    "total_debt": {
        "total_debt",
        "debt",
        "interest_bearing_debt",
        "total_liabilities",
        "liabilities",
        "tong_no_phai_tra",
        "no_phai_tra",
    },
    "current_assets": {"current_assets", "tai_san_hien_hanh", "tai_san_ngan_han"},
    "current_liabilities": {"current_liabilities", "no_hien_hanh", "no_ngan_han"},
    "inventory": {"inventory", "inventories", "hang_ton_kho"},
    "cogs": {"cogs", "cost_of_goods_sold", "cost_of_sales", "gia_von_hang_ban"},
    "operating_cash_flow": {
        "operating_cash_flow",
        "cash_flow_from_operating_activities",
        "net_cash_flow_from_operating_activities",
        "luu_chuy_tien_hoat_dong",
        "luu_chuyen_tien_thuan_tu_hoat_dong_kinh_doanh",
    },
    "eps": {"eps", "earnings_per_share", "loi_nhuan_tren_co_phieu"},
    "bvps": {
        "bvps",
        "book_value_per_share",
        "von_chu_so_huu_tren_co_phieu",
        "gia_tri_so_sach_tren_co_phieu",
    },
    "advances": {"advances", "buyer_prepayments", "customer_advances", "nguoi_mua_tra_tien_truoc"},
    "shares_outstanding": {
        "shares_outstanding",
        "outstanding_shares",
        "listed_shares",
        "weighted_average_shares",
        "so_luong_co_phieu_luu_hanh",
    },
    "audit_opinion": {"audit_opinion", "audit_status", "audited_status", "kiem_toan"},
}

_ROW_METADATA_COLUMNS = {"item", "item_en", "item_id", "unit", "levels", "row_number"}

# VCI is the primary BCTC source (richer alias mapping); KBS is fallback for tickers
# VCI doesn't cover. vnstock.api.financial.Finance only accepts these two sources.
_FINANCIAL_SOURCES: tuple[str, ...] = ("VCI", "KBS")


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
    """Stateless wrapper. Mỗi method gate qua `_gate.wait()` theo cấu hình env."""

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
            from vnstock.api.quote import DataSource, Quote, TimeResolutions  # lazy import

            end = date.today()
            start = end - timedelta(days=days)
            quote = Quote(source=DataSource.VCI, symbol=ticker, show_log=False)
            df = quote.history(
                symbol=ticker,
                start=start.isoformat(),
                end=end.isoformat(),
                interval=TimeResolutions.DAY_1,
            )
        except (Exception, SystemExit) as e:  # vnstock quota path calls sys.exit()
            logger.warning("vnstock prices failed for %s: %s", ticker, e)
            raise VnstockUnavailable(f"prices fetch failed for {ticker}: {e}") from e

        rows: list[dict[str, Any]] = []
        if df is None or len(df) == 0:
            return rows
        for _, r in df.iterrows():
            # vnstock VCI returns OHLC in thousand-VND units; DB convention (demo_seed + filter
            # PRICE_FLOOR=15_000) is raw VND, so scale ×1000 on ingest.
            rows.append(
                {
                    "ticker": ticker,
                    "date": _to_date(r.get("time") or r.get("date")),
                    "open": _scale_vnd(r.get("open")),
                    "high": _scale_vnd(r.get("high")),
                    "low": _scale_vnd(r.get("low")),
                    "close": _scale_vnd(r.get("close")),
                    "volume": _to_int(r.get("volume")),
                }
            )
        return rows

    def fetch_financials(self, ticker: str) -> list[dict[str, Any]]:
        """Quarterly financial reports. Return list of dicts (period, year, quarter, fields...).

        Lỗi network/library trên tất cả source fallback → raise `VnstockUnavailable`.
        Empty result → list rỗng.

        Vnstock guest quota = 20 req/min; BCTC = 4 sub-calls/ticker. Each sub-call
        gates through `_gate_wait()` so the burst stays under the quota line.
        """
        last_error: Exception | None = None
        for source in _FINANCIAL_SOURCES:
            try:
                rows = self._fetch_financials_source(ticker, source)
            except (Exception, SystemExit) as e:
                last_error = e if isinstance(e, Exception) else RuntimeError(str(e))
                logger.warning("vnstock financials source=%s failed for %s: %s", source, ticker, e)
                continue
            if rows:
                if source != _FINANCIAL_SOURCES[0]:
                    logger.info("vnstock financials %s served by fallback source=%s", ticker, source)
                return rows
            logger.info("vnstock financials source=%s empty for %s; trying next", source, ticker)
        if last_error is not None:
            raise VnstockUnavailable(
                f"financials fetch failed for {ticker} across {_FINANCIAL_SOURCES}: {last_error}"
            ) from last_error
        return []

    def _fetch_financials_source(self, ticker: str, source: str) -> list[dict[str, Any]]:
        from vnstock.api.financial import Finance  # lazy import

        finance = Finance(source=source, symbol=ticker, period="quarter", get_all=True, show_log=False)
        self._gate_wait()
        income_df = finance.income_statement(period="quarter", lang="en", dropna=False, show_log=False)
        self._gate_wait()
        balance_df = finance.balance_sheet(period="quarter", lang="en", dropna=False, show_log=False)
        self._gate_wait()
        cash_df = finance.cash_flow(period="quarter", lang="en", dropna=False, show_log=False)
        try:
            self._gate_wait()
            ratio_df = finance.ratio(period="quarter", lang="en", dropna=False, show_log=False)
        except (Exception, SystemExit) as e:
            logger.info("vnstock ratio skipped for %s (source=%s): %s", ticker, source, e)
            ratio_df = None
        return _merge_financial_frames(
            ticker,
            income=income_df,
            balance=balance_df,
            cash=cash_df,
            ratio=ratio_df,
        )


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


def _scale_vnd(v: Any) -> float | None:
    f = _to_float(v)
    return None if f is None else f * 1000.0


def _to_int(v: Any) -> int | None:
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _merge_financial_frames(
    ticker: str,
    *,
    income: Any,
    balance: Any,
    cash: Any,
    ratio: Any = None,
) -> list[dict[str, Any]]:
    reports: dict[str, dict[str, Any]] = {}
    for frame in (income, balance, cash, ratio):
        for period, values in _extract_financial_frame(frame).items():
            year, quarter = _parse_quarter_period(period)
            if year is None or quarter is None:
                continue
            row = reports.setdefault(
                f"{year}Q{quarter}",
                {"ticker": ticker, "period": f"{year}Q{quarter}", "year": year, "quarter": quarter},
            )
            row.update({k: v for k, v in values.items() if v is not None})

    rows = list(reports.values())
    rows.sort(key=lambda r: (r["year"], r["quarter"]), reverse=True)
    return rows


def _extract_financial_frame(frame: Any) -> dict[str, dict[str, Any]]:
    if frame is None or len(frame) == 0:
        return {}
    columns = {str(c) for c in getattr(frame, "columns", [])}
    if columns & _ROW_METADATA_COLUMNS:
        return _extract_item_period_frame(frame)
    return _extract_period_rows_frame(frame)


def _extract_item_period_frame(frame: Any) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    value_columns = [
        str(c)
        for c in getattr(frame, "columns", [])
        if str(c) not in _ROW_METADATA_COLUMNS and _parse_quarter_period(str(c))[0] is not None
    ]
    if not value_columns:
        return out

    audit_status = getattr(frame, "attrs", {}).get("audit_status", {})
    for _, row in frame.iterrows():
        field = _canonical_field(row.get("item_id"), row.get("item_en"), row.get("item"))
        if field is None:
            continue
        for period in value_columns:
            value = row.get(period)
            target = out.setdefault(period, {})
            target[field] = str(value) if field == "audit_opinion" and value is not None else _to_number(value)

    if isinstance(audit_status, dict):
        for period, value in audit_status.items():
            if period in out and value:
                out[period]["audit_opinion"] = str(value)
    return out


def _extract_period_rows_frame(frame: Any) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for _, row in frame.iterrows():
        period = _row_period(row)
        if not period:
            continue
        values: dict[str, Any] = {}
        for column, value in row.items():
            field = _canonical_field(column)
            if field is None:
                continue
            values[field] = str(value) if field == "audit_opinion" and value is not None else _to_number(value)
        if values:
            out.setdefault(period, {}).update(values)
    return out


def _row_period(row: Any) -> str | None:
    for key in ("period", "report_period", "year_quarter", "term", "quarter"):
        year, quarter = _parse_quarter_period(row.get(key))
        if year is not None and quarter is not None:
            return f"{year}Q{quarter}"
    year = _to_int(row.get("year") or row.get("yearReport") or row.get("YearPeriod"))
    quarter = _to_int(row.get("quarter") or row.get("lengthReport") or row.get("quarterReport"))
    if year and quarter and 1 <= quarter <= 4:
        return f"{year}Q{quarter}"
    return None


def _parse_quarter_period(value: Any) -> tuple[int | None, int | None]:
    if value is None:
        return None, None
    text = str(value).strip()
    match = re.search(r"(?P<year>20\d{2})\s*[-_/]?\s*[Qq](?P<quarter>[1-4])", text)
    if match:
        return int(match.group("year")), int(match.group("quarter"))
    match = re.search(r"[Qq](?P<quarter>[1-4])\s*[-_/]?\s*(?P<year>20\d{2})", text)
    if match:
        return int(match.group("year")), int(match.group("quarter"))
    match = re.search(r"(?P<year>20\d{2}).*?(?:quy|quarter|q)\s*(?P<quarter>[1-4])", _normalize_key(text))
    if match:
        return int(match.group("year")), int(match.group("quarter"))
    return None, None


def _canonical_field(*values: Any) -> str | None:
    keys = {_normalize_key(v) for v in values if v is not None}
    keys.discard("")
    for field, aliases in _FIELD_ALIASES.items():
        if keys & aliases:
            return field
    joined = "_".join(sorted(keys))
    for field, aliases in _FIELD_ALIASES.items():
        if any(alias and alias in joined for alias in aliases):
            return field
    return None


def _normalize_key(value: Any) -> str:
    text = unicode_normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not combining(ch))
    text = re.sub(r"[^0-9A-Za-z]+", "_", text).strip("_").lower()
    return text


def _to_number(value: Any) -> float | int | None:
    if value is None:
        return None
    if isinstance(value, str) and value.strip() in {"", "-", "nan", "None"}:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number
