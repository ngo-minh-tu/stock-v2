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
        "net_sales",
        "net_sales_revenue",
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
        "profit_after_tax_for_shareholders_of_parent_company",
        "net_profit_attributable_to_shareholders_of_parent",
    },
    "total_assets": {"total_assets", "tong_tai_san", "tong_cong_tai_san"},
    "total_equity": {
        "total_equity",
        "equity",
        "shareholders_equity",
        "owners_equity",
        "von_chu_so_huu",
        "owner_equity",
        # KBS hierarchical "D. VỐN CHỦ SỞ HỮU" → after prefix-strip "owners_equity" (already above).
    },
    "total_debt": {
        "total_debt",
        "total_liabilities",
        "liabilities",
        "tong_no_phai_tra",
        "no_phai_tra",
        # KBS "C. NỢ PHẢI TRẢ" → after strip "liabilities" (already above).
    },
    "current_assets": {
        "current_assets",
        "short_term_assets",
        "tai_san_hien_hanh",
        "tai_san_ngan_han",
    },
    "current_liabilities": {
        "current_liabilities",
        "short_term_liabilities",
        "no_hien_hanh",
        "no_ngan_han",
    },
    "inventory": {"inventory", "inventories", "hang_ton_kho"},
    "cogs": {"cogs", "cost_of_goods_sold", "cost_of_sales", "gia_von_hang_ban"},
    "operating_cash_flow": {
        "operating_cash_flow",
        "cash_flow_from_operating_activities",
        "net_cash_flow_from_operating_activities",
        "net_cash_flows_from_operating_activities",  # KBS plural variant
        "luu_chuy_tien_hoat_dong",
        "luu_chuyen_tien_thuan_tu_hoat_dong_kinh_doanh",
    },
    "eps": {
        "eps",
        "earnings_per_share",
        "earnings_per_share_vnd",  # KBS suffix variant
        "loi_nhuan_tren_co_phieu",
    },
    "bvps": {
        "bvps",
        "book_value_per_share",
        "von_chu_so_huu_tren_co_phieu",
        "gia_tri_so_sach_tren_co_phieu",
    },
    "advances": {
        "advances",
        "buyer_prepayments",
        "customer_advances",
        "nguoi_mua_tra_tien_truoc",
        "short_term_advances_from_customers",
    },
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

# Strict blocklist: rows whose normalized id should NOT match any field even by alias —
# typically grand-totals (accounting identity = total_assets), section headers, or
# subtotals that pollute when written. Phase 21 — Codex Phase 17 finding.
_FIELD_BLOCKLIST: set[str] = {
    "total_owners_equity_and_liabilities",  # KBS grand total row (= total_assets)
    "total_equity_and_liabilities",         # alternative phrasing
    "nguon_von",                            # KBS section header "NGUỒN VỐN" (item_id=`owners_equity` but VALUE=NaN; defensive)
    "tai_san",                              # KBS section header "TÀI SẢN" (item_id=`assets` value=NaN; defensive)
}

# KBS item_ids carry hierarchy prefixes like `n_1.`, `n_18.`, `a.`, `b.`, `c.`, `d.`,
# `i.`, `ii.`, `iii.`, `iv.`, `v.`, `vi.`, `vii.`, `viii.`, `ix.`, `x.`. Strip BEFORE
# the canonical-field lookup so the trailing canonical name (e.g. `revenue`,
# `liabilities`, `owners_equity`) reaches the alias set unchanged.
_KBS_PREFIX_PATTERN = re.compile(
    r"^(?:n_\d+|[abcdefgh]|[ivx]{1,4})_",
    re.IGNORECASE,
)

# Phase 22 — vnstock VCI + KBS return financial VND fields in **thousand VND**
# (same convention as prices fixed in Phase 16). Apply ×1000 at ingest boundary
# so DB stores raw VND, consistent with `stock_prices.close`. Per-share fields
# (`eps`, `bvps`) and counts (`shares_outstanding`) + categorical (`audit_opinion`)
# are NOT scaled.
_FINANCIAL_VND_FIELDS: set[str] = {
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
    "advances",
}

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
        if get_settings().vnstock_client_stub:
            return []
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
        """Quarterly financial reports.

        Phase 21 — **multi-source merge**: try *all* sources sequentially and merge
        their rows per `(year, quarter)`. The first source in `_FINANCIAL_SOURCES`
        (VCI = authoritative) wins on conflict; subsequent sources (KBS) fill in
        gaps where VCI returned NULL. This way 12 ticker where VCI returns sparse
        data still get `net_income`, `eps`, `operating_cash_flow`, `bvps` from KBS
        (Codex Phase 17 finding — KBS coverage previously wasted because of
        first-non-empty-wins).

        Vnstock guest quota = 20 req/min; BCTC = 4 sub-calls/ticker per source.
        With 2 sources × 4 sub-calls = 8 sub-calls/ticker × ~6.5s gating ≈ 52s/ticker.
        For 26 real RE ticker this is ~22 minutes total — trade-off for coverage.

        Lỗi network/library trên tất cả source → raise `VnstockUnavailable` ONLY
        if no source produced any rows. Otherwise return whatever merged so far.
        """
        if get_settings().vnstock_client_stub:
            return []
        last_error: Exception | None = None
        merged: dict[str, dict[str, Any]] = {}
        any_source_succeeded = False
        for source in _FINANCIAL_SOURCES:
            try:
                rows = self._fetch_financials_source(ticker, source)
            except (Exception, SystemExit) as e:
                last_error = e if isinstance(e, Exception) else RuntimeError(str(e))
                logger.warning("vnstock financials source=%s failed for %s: %s", source, ticker, e)
                continue
            if not rows:
                logger.info("vnstock financials source=%s empty for %s; trying next", source, ticker)
                continue
            _apply_source_scaling(rows, source)
            any_source_succeeded = True
            # Merge per period — primary (first) source wins, later sources fill gaps.
            for row in rows:
                period_key = row.get("period")
                if not period_key:
                    continue
                existing = merged.setdefault(period_key, {})
                for k, v in row.items():
                    if v is None:
                        continue
                    if existing.get(k) is None:
                        existing[k] = v
        if not any_source_succeeded and last_error is not None:
            raise VnstockUnavailable(
                f"financials fetch failed for {ticker} across {_FINANCIAL_SOURCES}: {last_error}"
            ) from last_error
        # Sort newest first to match the previous return order (downstream expects DESC).
        rows = list(merged.values())
        rows.sort(key=lambda r: (r.get("year", 0), r.get("quarter", 0)), reverse=True)
        _compute_derived_fields(rows, ticker=ticker)
        return rows

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
    """Parse item × period DataFrame (KBS shape, occasionally VCI).

    Phase 21 changes:
    - Iterate value columns in suffix-first order so the **base period** (e.g. `2025-Q4`)
      writes LAST and overrides the restated `_1` variant (e.g. `2025-Q4_1`).
    - Skip rows whose normalized id appears in `_FIELD_BLOCKLIST` (grand totals + headers).
    - Skip values that resolve to None — preserves any real value written earlier.
    """
    out: dict[str, dict[str, Any]] = {}
    value_columns = _ordered_value_columns(frame)
    if not value_columns:
        return out

    audit_status = getattr(frame, "attrs", {}).get("audit_status", {})
    for _, row in frame.iterrows():
        field = _canonical_field(row.get("item_id"), row.get("item_en"), row.get("item"))
        if field is None:
            continue
        for period in value_columns:
            raw_value = row.get(period)
            number_or_str = (
                str(raw_value)
                if field == "audit_opinion" and raw_value is not None
                else _to_number(raw_value)
            )
            if number_or_str is None:
                # Don't overwrite a previously-written real value with None / NaN.
                continue
            target = out.setdefault(period, {})
            target[field] = number_or_str

    if isinstance(audit_status, dict):
        for period, value in audit_status.items():
            if period in out and value:
                out[period]["audit_opinion"] = str(value)
    return out


def _ordered_value_columns(frame: Any) -> list[str]:
    """Return value columns ordered such that base period (no `_N` suffix) is
    written LAST — last-write-wins gives base period precedence over restated.

    **Locked convention (Phase 21, re-confirmed Phase 26):** KBS sometimes ships
    both `2025-Q4` (base, ban đầu) và `2025-Q4_1` (restated). Cả hai map về cùng
    period key `2025Q4` → collision. Chính sách:

    - **Base period thắng** = preserves the originally-reported figure.
    - Rationale: trader audit (so sánh với CafeF/Vietstock) check số GỐC; restated
      có thể là đính chính/cải toán, làm khó so sánh. Wait trader feedback if
      preference flip needed.

    Phase 26 logs collision khi cả 2 variant cùng có giá trị → operator detect
    silent drift (vd KBS đổi convention restated thắng).
    """
    cols: list[tuple[str, bool]] = []
    for c in getattr(frame, "columns", []):
        s = str(c)
        if s in _ROW_METADATA_COLUMNS:
            continue
        if _parse_quarter_period(s)[0] is None:
            continue
        has_suffix = bool(re.search(r"_\d+$", s))
        cols.append((s, has_suffix))
    # suffix=True first (key 0), suffix=False last (key 1) → base period overrides
    cols.sort(key=lambda t: 0 if t[1] else 1)
    _log_period_suffix_collisions(cols)
    return [name for name, _ in cols]


def _log_period_suffix_collisions(cols: list[tuple[str, bool]]) -> None:
    """Phase 26 — emit info log khi base + restated variants cùng tồn tại cho
    1 period. Operator grep "period suffix collision" để audit drift.
    """
    base_periods: dict[str, str] = {}
    suffix_periods: dict[str, list[str]] = {}
    for name, has_suffix in cols:
        # Normalize tới base period key (strip `_N`).
        base = re.sub(r"_\d+$", "", name)
        if has_suffix:
            suffix_periods.setdefault(base, []).append(name)
        else:
            base_periods[base] = name
    for base_key, suffix_names in suffix_periods.items():
        if base_key in base_periods:
            # Phase 28 — INFO → DEBUG: refresh 26 ticker × 4 sub-call × 2 source ×
            # nhiều quarter có thể emit hàng trăm collision line, spam log
            # aggregator. Operator audit khi cần qua `LOG_LEVEL=DEBUG`.
            logger.debug(
                "period suffix collision: base=%s, restated=%s → base wins (Phase 26 locked)",
                base_periods[base_key], suffix_names,
            )


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
            converted = (
                str(value)
                if field == "audit_opinion" and value is not None
                else _to_number(value)
            )
            if converted is None:
                continue
            values[field] = converted
        if values:
            out.setdefault(period, {}).update(values)
    return out


def _compute_derived_fields(rows: list[dict[str, Any]], *, ticker: str) -> None:
    """Phase 26 — fill `bvps` from `total_equity / shares_outstanding` khi parser
    không có per-share field.

    vnstock community-tier (cả VCI và KBS) thỉnh thoảng không trả `bvps` cho mọi
    quarter — đặc biệt KBS chỉ tô cho row latest. Fallback compute giữ `F02 P/B`
    feature có data thật thay vì cast 0.0 placeholder.

    Skip nếu:
      - bvps đã có giá trị (parser thắng — KHÔNG ghi đè).
      - total_equity None / ≤ 0 (định nghĩa BVPS yêu cầu equity dương).
      - shares_outstanding None / ≤ 0 (chia 0 + meaningless).

    `total_equity` đã raw VND sau Phase 22 scaling; `shares_outstanding` là count.
    Kết quả `bvps = VND / share`. Đồng bộ với spec convention "per-share VND, NOT
    scaled" (Phase 22 §5).
    """
    filled = 0
    for row in rows:
        if row.get("bvps") is not None:
            continue
        total_equity = row.get("total_equity")
        shares = row.get("shares_outstanding")
        if total_equity is None or shares is None:
            continue
        try:
            equity_f = float(total_equity)
            shares_f = float(shares)
        except (TypeError, ValueError):
            continue
        if equity_f <= 0 or shares_f <= 0:
            continue
        row["bvps"] = equity_f / shares_f
        filled += 1
    if filled:
        logger.debug(
            "[%s] bvps fallback filled %d quarter(s) from total_equity/shares_outstanding",
            ticker, filled,
        )


def _apply_source_scaling(rows: list[dict[str, Any]], source: str) -> None:
    """Phase 22 — apply ×1000 scaling for KBS only (returns ngàn đồng).

    VCI returns financial fields in raw VND already (vd VHM total_assets = 5e14
    raw = 500 trillion VND, matches reported figures). KBS returns in ngàn đồng
    (vd NLG total_assets = 2.65e10 raw = needs ×1000 → 2.65e13 = 26.5T VND).
    Per-share fields (eps, bvps) and counts (shares_outstanding) are NOT scaled
    in either source.
    """
    if source != "KBS":
        return
    for row in rows:
        for field in _FINANCIAL_VND_FIELDS:
            value = row.get(field)
            if value is not None and isinstance(value, (int, float)):
                row[field] = float(value) * 1000.0


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
    """Map a row's identifying labels to a canonical financial field.

    Phase 21:
    - Strip KBS hierarchy prefix (`n_18.`, `c.`, `iii.` …) before matching.
    - Exact-match against alias sets only — no substring fallback (the old
      substring matcher conflated grand-total rows like
      `total_owners_equity_and_liabilities` with `total_equity`).
    - Blocklist explicit grand-totals / section headers.
    """
    raw_keys = {_normalize_key(v) for v in values if v is not None}
    raw_keys.discard("")
    # Also include prefix-stripped variants (e.g. `n_1.revenue` → `revenue`).
    expanded: set[str] = set()
    for k in raw_keys:
        expanded.add(k)
        stripped = _KBS_PREFIX_PATTERN.sub("", k)
        if stripped and stripped != k:
            expanded.add(stripped)
    if expanded & _FIELD_BLOCKLIST:
        return None
    for field, aliases in _FIELD_ALIASES.items():
        if expanded & aliases:
            return field
    return None


def _normalize_key(value: Any) -> str:
    text = unicode_normalize("NFKD", str(value))
    text = "".join(ch for ch in text if not combining(ch))
    text = re.sub(r"[^0-9A-Za-z]+", "_", text).strip("_").lower()
    return text


def _to_number(value: Any) -> float | int | None:
    import math as _math

    if value is None:
        return None
    if isinstance(value, str) and value.strip() in {"", "-", "nan", "None"}:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if _math.isnan(number) or _math.isinf(number):
        return None
    return int(number) if number.is_integer() else number
