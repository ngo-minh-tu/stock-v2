"""Stock list + Price Board + price history — TAD g02 §7.1 + SRS f05/f08."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.constants.thresholds import VND_RAW_TO_NGAN_DONG
from app.models.run import ScreeningResult, ScreeningRun
from app.models.stock import Stock, StockPrice
from app.repositories import price_repo, screening_repo


def _to_ngan_dong(v: float | int | None) -> float:
    if v is None:
        return 0.0
    return round(float(v) / VND_RAW_TO_NGAN_DONG, 2)


def _build_latest_price(p: StockPrice | None, latest_close_override: float | None = None) -> dict | None:
    if p is None:
        return None
    close_raw = float(p.close) if p.close is not None else 0.0
    if latest_close_override is not None and latest_close_override > 0:
        close_raw = latest_close_override

    ref_raw = float(p.reference) if p.reference is not None else close_raw
    change_raw = close_raw - ref_raw
    change_pct = (change_raw / ref_raw * 100.0) if ref_raw > 0 else 0.0

    return {
        "open": _to_ngan_dong(p.open if p.open is not None else close_raw),
        "high": _to_ngan_dong(p.high if p.high is not None else close_raw),
        "low": _to_ngan_dong(p.low if p.low is not None else close_raw),
        "close": _to_ngan_dong(close_raw),
        "reference": _to_ngan_dong(ref_raw),
        "ceiling": _to_ngan_dong(p.ceiling if p.ceiling is not None else ref_raw * 1.07),
        "floor": _to_ngan_dong(p.floor if p.floor is not None else ref_raw * 0.93),
        "change": round(change_raw / VND_RAW_TO_NGAN_DONG, 2),
        "change_pct": round(change_pct, 2),
        "volume": int(p.volume) if p.volume is not None else 0,
        "as_of": p.date.isoformat() if p.date else "",
    }


def list_stocks_with_prices(
    db: Session,
    *,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """`current_price` ưu tiên từ run mới nhất terminal (TAD g02 §7.1 anchor logic),
    fallback sang StockPrice.close mới nhất.
    """
    tradable_universe = ~Stock.ticker.like("MOCK%")
    stmt = (
        select(Stock)
        .where(tradable_universe)
        .order_by(Stock.ticker)
        .limit(limit)
        .offset(offset)
    )
    stocks = list(db.scalars(stmt))
    total = db.scalar(select(func.count()).select_from(Stock).where(tradable_universe)) or 0

    latest_prices = price_repo.latest_per_ticker(db)
    latest_run = screening_repo.latest_completed(db)
    run_close_by_ticker: dict[str, float] = {}
    if latest_run is not None:
        rows = db.scalars(
            select(ScreeningResult).where(ScreeningResult.run_id == latest_run.run_id)
        ).all()
        run_close_by_ticker = {
            r.ticker: float(r.current_price) for r in rows if r.current_price is not None
        }

    items = []
    for s in stocks:
        latest_p = latest_prices.get(s.ticker)
        override = run_close_by_ticker.get(s.ticker)
        items.append(
            {
                "ticker": s.ticker,
                "name": s.name,
                "exchange": s.exchange,
                "sector": s.sector,
                "newly_listed": bool(s.newly_listed),
                "latest": _build_latest_price(latest_p, override),
            }
        )
    return {"items": items, "total": int(total), "limit": limit, "offset": offset}


def get_stock_static(db: Session, ticker: str) -> dict | None:
    s = db.get(Stock, ticker)
    if s is None:
        return None
    p = price_repo.latest(db, ticker)
    latest_run = screening_repo.latest_completed(db)
    override = None
    if latest_run is not None:
        row = db.scalar(
            select(ScreeningResult).where(
                ScreeningResult.run_id == latest_run.run_id,
                ScreeningResult.ticker == ticker,
            )
        )
        if row is not None and row.current_price is not None:
            override = float(row.current_price)

    return {
        "ticker": s.ticker,
        "name": s.name,
        "exchange": s.exchange,
        "sector": s.sector,
        "newly_listed": bool(s.newly_listed),
        "status": s.status,
        "latest": _build_latest_price(p, override),
    }


# ---------------------------------------------------------------------------
# Price history (Stock Detail candlestick)
# ---------------------------------------------------------------------------

LOOKBACK_DAYS: dict[str, int] = {
    "1T": 7,    # 1 tuần
    "3T": 21,   # 3 tuần (giao dịch)
    "6T": 126,  # 6 tháng (~6 tháng × 21 phiên)
    "1N": 252,  # 1 năm
    "3N": 756,
    "YTD": 252,  # cap year-to-date — caller compute từ start of year nếu cần
    "All": 9999,
}


def _aggregate(bars: list[StockPrice], interval: str) -> list[dict]:
    """Aggregate daily → weekly/monthly. interval ∈ {D,W,M}."""
    if interval == "D" or not bars:
        return [
            {
                "date": b.date.isoformat() if b.date else "",
                "open": _to_ngan_dong(b.open),
                "high": _to_ngan_dong(b.high),
                "low": _to_ngan_dong(b.low),
                "close": _to_ngan_dong(b.close),
                "volume": int(b.volume or 0),
            }
            for b in bars
        ]

    # Group by ISO week (W) hoặc YYYY-MM (M)
    groups: dict[str, list[StockPrice]] = {}
    keys: list[str] = []
    for b in bars:
        if b.date is None:
            continue
        key = b.date.strftime("%Y-W%V") if interval == "W" else b.date.strftime("%Y-%m")
        if key not in groups:
            groups[key] = []
            keys.append(key)
        groups[key].append(b)

    out = []
    for k in keys:
        group = groups[k]
        opens = [b for b in group if b.open is not None]
        closes = [b for b in group if b.close is not None]
        highs = [float(b.high) for b in group if b.high is not None]
        lows = [float(b.low) for b in group if b.low is not None]
        vols = [int(b.volume) for b in group if b.volume is not None]
        first_b = group[0]
        last_b = group[-1]
        out.append(
            {
                "date": (first_b.date.isoformat() if first_b.date else ""),
                "open": _to_ngan_dong(opens[0].open if opens else first_b.close),
                "high": _to_ngan_dong(max(highs) if highs else 0),
                "low": _to_ngan_dong(min(lows) if lows else 0),
                "close": _to_ngan_dong(closes[-1].close if closes else last_b.close),
                "volume": sum(vols),
            }
        )
    return out


def _sma(values: list[float], window: int) -> list[float | None]:
    """Simple moving average aligned 1-to-1 với input. null khi i < window-1."""
    out: list[float | None] = []
    running = 0.0
    for i, v in enumerate(values):
        running += v
        if i >= window:
            running -= values[i - window]
        out.append(round(running / window, 4) if i >= window - 1 else None)
    return out


def _compute_indicators(bars: list[dict]) -> dict:
    """MA20/50/200 trên close + MA20 trên volume. Aligned 1-to-1 với bars."""
    closes = [float(b["close"]) for b in bars]
    volumes = [float(b["volume"]) for b in bars]
    return {
        "ma20": _sma(closes, 20),
        "ma50": _sma(closes, 50),
        "ma200": _sma(closes, 200),
        "ma_volume_20": _sma(volumes, 20),
    }


def get_price_history(
    db: Session,
    *,
    ticker: str,
    interval: str = "D",
    lookback: str = "6T",
) -> dict:
    interval = (interval or "D").upper()
    if interval not in {"D", "W", "M"}:
        interval = "D"
    days = LOOKBACK_DAYS.get(lookback, 126)
    today = date.today()
    start = today - timedelta(days=days * 2)  # buffer cho weekly/monthly aggregation
    bars = price_repo.list_between(db, ticker, start, today)
    aggregated = _aggregate(bars, interval)
    return {
        "ticker": ticker,
        "interval": interval,
        "lookback": lookback,
        "bars": aggregated,
        "indicators": _compute_indicators(aggregated),
    }


# ---------------------------------------------------------------------------
# Stock runs (Stock Detail run selector dropdown)
# ---------------------------------------------------------------------------

def list_runs_for_stock(db: Session, ticker: str, *, limit: int = 20) -> dict:
    """Run nào đã chấm mã này — sort run_at DESC."""
    stmt = (
        select(ScreeningResult, ScreeningRun)
        .join(ScreeningRun, ScreeningResult.run_id == ScreeningRun.run_id)
        .where(ScreeningResult.ticker == ticker)
        .order_by(desc(ScreeningRun.run_at))
        .limit(limit)
    )
    items: list[dict] = []
    for result, run in db.execute(stmt).all():
        items.append(
            {
                "run_id": run.run_id,
                "run_at": run.run_at.isoformat() if run.run_at else "",
                "status": run.status,
                "ai_score": round(float(result.ai_score), 2) if result.ai_score is not None else 0.0,
                "recommendation": result.recommendation or "BAN",
            }
        )
    return {"ticker": ticker, "items": items, "total": len(items)}


# Marker import retained for type completeness — used in list_runs_for_stock
_ = (price_repo, screening_repo, StockPrice)
