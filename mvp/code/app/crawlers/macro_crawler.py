"""Macro crawler for M01-M05.

SRS f02 defines:
- M01: policy/interest-rate proxy (SBV/news)
- M02: real-estate credit growth proxy (SBV/GSO)
- M03: CPI
- M04: FDI into Vietnam
- M05: VN-Index

The crawler prefers machine-readable sources so refresh jobs do not depend on
fragile table scraping. World Bank is used for broad macro proxies where SBV/GSO
do not expose a stable JSON endpoint, while VN-Index is fetched through vnstock
as required by PRD Appendix A.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from typing import Any

import httpx

from app.crawlers.vnstock_client import VnstockClient, VnstockUnavailable

logger = logging.getLogger(__name__)

HTTP_TIMEOUT = 15.0
WORLD_BANK_BASE = "https://api.worldbank.org/v2/country/VNM/indicator"


@dataclass(frozen=True, slots=True)
class MacroPoint:
    indicator: str
    period: str
    value: float
    source: str


def _fetch_world_bank_series(indicator: str, *, per_page: int = 3) -> list[dict[str, Any]]:
    url = f"{WORLD_BANK_BASE}/{indicator}"
    params = {"format": "json", "per_page": per_page, "MRV": per_page}
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        response = client.get(url, params=params, follow_redirects=True)
        response.raise_for_status()
    body = response.json()
    if not isinstance(body, list) or len(body) < 2 or not isinstance(body[1], list):
        return []
    rows = [r for r in body[1] if isinstance(r, dict) and r.get("value") is not None]
    rows.sort(key=lambda r: str(r.get("date") or ""), reverse=True)
    return rows


def _latest_world_bank_decimal(indicator: str, feature_id: str, source: str) -> MacroPoint | None:
    rows = _fetch_world_bank_series(indicator, per_page=3)
    if not rows:
        return None
    row = rows[0]
    return MacroPoint(
        indicator=feature_id,
        period=str(row["date"]),
        value=float(row["value"]) / 100.0,
        source=source,
    )


def _world_bank_credit_growth() -> MacroPoint | None:
    """M02 proxy: YoY growth of domestic credit to private sector (% GDP).

    SRS names real-estate credit growth, but public SBV/GSO machine-readable data
    is not stable. This computes a growth proxy from the latest two annual WDI
    observations instead of keeping a hardcoded quarter.
    """
    rows = _fetch_world_bank_series("FS.AST.PRVT.GD.ZS", per_page=5)
    if len(rows) < 2:
        return None
    latest = rows[0]
    prev = rows[1]
    latest_value = float(latest["value"])
    prev_value = float(prev["value"])
    if prev_value == 0:
        return None
    growth = (latest_value - prev_value) / abs(prev_value)
    return MacroPoint(
        indicator="M02",
        period=str(latest["date"]),
        value=growth,
        source="worldbank:FS.AST.PRVT.GD.ZS:yoy",
    )


def _world_bank_fdi() -> MacroPoint | None:
    rows = _fetch_world_bank_series("BX.KLT.DINV.CD.WD", per_page=3)
    if not rows:
        return None
    row = rows[0]
    return MacroPoint(
        indicator="M04",
        period=str(row["date"]),
        value=float(row["value"]),
        source="worldbank:BX.KLT.DINV.CD.WD",
    )


def _vnindex_latest(client: VnstockClient | None = None) -> MacroPoint | None:
    client = client or VnstockClient()
    rows = client.fetch_prices("VNINDEX", days=30)
    usable = [r for r in rows if r.get("date") and r.get("close") is not None]
    if not usable:
        return None
    latest = max(usable, key=lambda r: r["date"])
    return MacroPoint(
        indicator="M05",
        period=latest["date"].isoformat() if isinstance(latest["date"], date) else str(latest["date"]),
        value=float(latest["close"]) / 1000.0 if float(latest["close"]) > 10_000 else float(latest["close"]),
        source="vnstock:VNINDEX",
    )


def fetch_macro_points(*, vnstock_client: VnstockClient | None = None) -> tuple[list[MacroPoint], list[str]]:
    """Fetch best-effort M01-M05 points.

    Returns `(points, errors)`. Callers upsert points that succeeded and keep
    existing/seed rows for indicators whose public source is unavailable.
    """
    points: list[MacroPoint] = []
    errors: list[str] = []

    tasks = [
        ("M01", lambda: _latest_world_bank_decimal("FR.INR.LEND", "M01", "worldbank:FR.INR.LEND")),
        ("M02", _world_bank_credit_growth),
        ("M03", lambda: _latest_world_bank_decimal("FP.CPI.TOTL.ZG", "M03", "worldbank:FP.CPI.TOTL.ZG")),
        ("M04", _world_bank_fdi),
    ]
    for indicator, fn in tasks:
        try:
            point = fn()
            if point is None:
                errors.append(indicator)
            else:
                points.append(point)
        except Exception as exc:  # noqa: BLE001
            logger.warning("macro fetch failed for %s: %s", indicator, exc)
            errors.append(indicator)

    try:
        point = _vnindex_latest(vnstock_client)
        if point is None:
            errors.append("M05")
        else:
            points.append(point)
    except VnstockUnavailable as exc:
        logger.warning("macro VNINDEX fetch failed: %s", exc)
        errors.append("M05")
    except Exception as exc:  # noqa: BLE001
        logger.warning("macro VNINDEX unexpected failure: %s", exc)
        errors.append("M05")

    return points, errors
