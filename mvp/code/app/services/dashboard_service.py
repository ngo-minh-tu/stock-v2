"""Dashboard aggregate — SRS f04 + cluster 2 5-chart layout.

Aggregate cho 1 run đã COMPLETED: KPIs (4 counts + alpha) + treemap (all scored)
+ pie + radar (avg 5 group) + index_trend (26 weeks proxy) + top 10 by score.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.constants.thresholds import DASHBOARD_VNINDEX_3M_PROXY_PCT
from app.models.run import ScreeningResult, ScreeningRun
from app.models.stock import Stock
from app.repositories import results_repo, screening_repo


def _safe_avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _parse_radar(radar_json: str | None) -> dict[str, float]:
    if not radar_json:
        return {}
    try:
        data = json.loads(radar_json)
        return {k: float(v) for k, v in data.items()} if isinstance(data, dict) else {}
    except (ValueError, TypeError):
        return {}


def _vnindex_proxy_curve() -> list[dict]:
    """26 tuần proxy — chưa wire historical VN-Index. Smooth sin curve quanh 1100.

    Phase 8 backtest sẽ replace bằng historical actual.
    """
    base = 1100.0
    re_base = 1050.0
    today = datetime.utcnow().date()
    out: list[dict] = []
    for i in range(26):
        week_offset = 25 - i
        week_date = today - timedelta(weeks=week_offset)
        iso = week_date.strftime("%Y-W%V")
        # Sine wobble ±5% cho VN-Index, ±7% cho RE Index
        vn = round(base * (1.0 + 0.05 * math.sin(i * 0.4)), 2)
        re = round(re_base * (1.0 + 0.07 * math.sin(i * 0.3 + 1.0)), 2)
        out.append({"week": iso, "vnindex": vn, "realestate_index": re})
    return out


def build_dashboard(db: Session, run: ScreeningRun) -> dict:
    rows = results_repo.list_by_run(db, run.run_id)
    stocks_by_t = {s.ticker: s for s in db.query(Stock).all()}

    scored = len(rows)
    buy = sum(1 for r in rows if r.recommendation == "MUA")
    hold = sum(1 for r in rows if r.recommendation == "GIU")
    sell = sum(1 for r in rows if r.recommendation == "BAN")

    buy_upsides = [float(r.upside_pct) for r in rows if r.recommendation == "MUA" and r.upside_pct is not None]
    avg_buy_upside = _safe_avg(buy_upsides)
    alpha_pct = round(avg_buy_upside - DASHBOARD_VNINDEX_3M_PROXY_PCT, 1)

    # Treemap: all scored, market_cap proxy = ai_score × 10 (chưa có shares_outstanding column)
    treemap = []
    for r in rows:
        s = stocks_by_t.get(r.ticker)
        treemap.append(
            {
                "ticker": r.ticker,
                "name": s.name if s else r.ticker,
                "sector": s.sector if s else None,
                "ai_score": round(float(r.ai_score), 2) if r.ai_score is not None else 0.0,
                "recommendation": r.recommendation or "BAN",
                # Proxy: market_cap stub = ai_score × 10 (tỷ đồng) — Phase 7+ replace bằng real cap
                "market_cap": round(float(r.ai_score or 0) * 10.0, 1),
            }
        )

    pie = {"MUA": buy, "GIU": hold, "BAN": sell}

    # Radar avg 5 axes — mean across all scored
    radar_keys = ("fundamental", "technical", "macro", "realestate", "sentiment")
    radar_sum = dict.fromkeys(radar_keys, 0.0)
    radar_n = 0
    for r in rows:
        rd = _parse_radar(r.radar_json)
        if rd:
            for k in radar_keys:
                radar_sum[k] += rd.get(k, 0.0)
            radar_n += 1
    radar_avg = {k: round(radar_sum[k] / radar_n, 2) if radar_n else 0.0 for k in radar_keys}

    index_trend = _vnindex_proxy_curve()

    # Top 10 by score DESC
    sorted_rows = sorted(
        ((r.ticker, float(r.ai_score or 0), r.recommendation or "BAN") for r in rows),
        key=lambda t: t[1],
        reverse=True,
    )[:10]
    top10 = [
        {"ticker": t, "ai_score": round(score, 2), "recommendation": rec}
        for t, score, rec in sorted_rows
    ]

    return {
        "run_id": run.run_id,
        "run_at": run.run_at.isoformat() if run.run_at else None,
        "kpis": {
            "scored_count": scored,
            "buy_count": buy,
            "hold_count": hold,
            "sell_count": sell,
            "alpha_pct": alpha_pct,
        },
        "treemap": treemap,
        "pie": pie,
        "radar_avg": radar_avg,
        "index_trend": index_trend,
        "top_by_score": top10,
    }


def get_run_or_none(db: Session, run_id: str) -> ScreeningRun | None:
    return screening_repo.get(db, run_id)


__all__ = ["build_dashboard", "get_run_or_none"]


# Make ScreeningResult import-resolvable (model registration ensures FK)
_ = ScreeningResult
