"""Reshape screening_results rows → API DTOs.

JSON columns (warning_badges, reasons, feature_values, radar) lưu raw text trong
DB; service parse + cast unit (raw VND → ngàn đồng cho price fields).
"""

from __future__ import annotations

import json
from typing import Any

from app.constants.thresholds import VND_RAW_TO_NGAN_DONG
from app.models.run import ScreeningResult
from app.models.stock import Stock


def _parse_json(text: str | None, default: Any) -> Any:
    if not text:
        return default
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        return default


def _to_ngan_dong(value: float | None) -> float | None:
    """Raw VND (e.g. 35_000) → ngàn đồng (35.0). 2dp."""
    if value is None:
        return None
    return round(float(value) / VND_RAW_TO_NGAN_DONG, 2)


def to_result_row(row: ScreeningResult, stock: Stock | None) -> dict:
    """Compact row cho /runs/{id}/results — TAD g02 §4 + cluster 2 RunResult shape."""
    badges = _parse_json(row.warning_badges_json, [])
    radar = _parse_json(row.radar_json, {})
    return {
        "ticker": row.ticker,
        "name": stock.name if stock else row.ticker,
        "sector": stock.sector if stock else None,
        "exchange": stock.exchange if stock else "HOSE",
        "current_price": _to_ngan_dong(float(row.current_price)) if row.current_price is not None else 0.0,
        "market_cap": None,  # Phase 6 chưa wire market_cap (cần shares_outstanding × price)
        "ai_score": round(float(row.ai_score), 2) if row.ai_score is not None else 0.0,
        "recommendation": row.recommendation or "BAN",
        "confidence_raw": round(float(row.confidence_raw), 2) if row.confidence_raw is not None else 0.0,
        "confidence_penalty": int(row.confidence_penalty or 0),
        "confidence": round(float(row.confidence), 2) if row.confidence is not None else 0.0,
        "target_price_3m": _to_ngan_dong(float(row.target_price_3m)) if row.target_price_3m is not None else 0.0,
        "upside_pct": round(float(row.upside_pct), 2) if row.upside_pct is not None else 0.0,
        "entry_signal": row.entry_signal or "NO_ENTRY",
        "entry_reason_code": row.entry_reason_code or "",
        "support_zone": _to_ngan_dong(float(row.support_zone)) if row.support_zone is not None else 0.0,
        "resistance_zone": _to_ngan_dong(float(row.resistance_zone)) if row.resistance_zone is not None else 0.0,
        "stop_loss_price": _to_ngan_dong(float(row.stop_loss_price)) if row.stop_loss_price is not None else 0.0,
        "allocation_amount": float(row.allocation_amount) if row.allocation_amount is not None else None,
        "allocation_weight": float(row.allocation_weight) if row.allocation_weight is not None else None,
        "warning_badges": badges if isinstance(badges, list) else [],
        "feature_availability": int(row.feature_availability or 0),
        "radar": radar if isinstance(radar, dict) else {},
    }


def to_stock_detail(row: ScreeningResult, stock: Stock | None) -> dict:
    """Full Stock Detail shape — TAD g02 §4."""
    badges = _parse_json(row.warning_badges_json, [])
    reasons_raw = _parse_json(row.reasons_json, [])
    features = _parse_json(row.feature_values_json, {})
    radar = _parse_json(row.radar_json, {})

    # Reasons render-friendly: enrich với feature value nếu có
    reasons: list[dict[str, Any]] = []
    if isinstance(reasons_raw, list):
        for r in reasons_raw:
            if isinstance(r, dict):
                fid = r.get("feature_id", "")
                reasons.append(
                    {
                        "feature_id": fid,
                        "value": features.get(fid) if isinstance(features, dict) else None,
                        "score": r.get("score"),
                        "direction": r.get("direction"),
                    }
                )

    return {
        "ticker": row.ticker,
        "name": stock.name if stock else row.ticker,
        "run_id": row.run_id,
        "static": {
            "exchange": stock.exchange if stock else "HOSE",
            "sector": stock.sector if stock else None,
            "name": stock.name if stock else row.ticker,
            "current_price": _to_ngan_dong(float(row.current_price)) or 0.0,
        },
        "scoring": {
            "ai_score": round(float(row.ai_score), 2) if row.ai_score is not None else 0.0,
            "recommendation": row.recommendation or "BAN",
            "confidence_raw": round(float(row.confidence_raw), 2) if row.confidence_raw is not None else 0.0,
            "confidence_penalty": int(row.confidence_penalty or 0),
            "confidence": round(float(row.confidence), 2) if row.confidence is not None else 0.0,
            "target_price_3m": _to_ngan_dong(float(row.target_price_3m)) or 0.0,
            "upside_pct": round(float(row.upside_pct), 2) if row.upside_pct is not None else 0.0,
            "radar_industry_avg": None,  # Phase 6 chưa wire industry avg per sector — Phase 7+ revisit
        },
        "entry": {
            "signal": row.entry_signal or "NO_ENTRY",
            "reason_code": row.entry_reason_code or "",
            "support_zone": _to_ngan_dong(float(row.support_zone)) or 0.0,
            "resistance_zone": _to_ngan_dong(float(row.resistance_zone)) or 0.0,
            "raw_indicators_used": [],  # Phase 4 EntryResult.raw_indicators_used không lưu DB; Phase 7 revisit
        },
        "risk": {
            "stop_loss_price": _to_ngan_dong(float(row.stop_loss_price)) or 0.0,
            "allocation_amount": float(row.allocation_amount) if row.allocation_amount is not None else None,
            "allocation_weight": float(row.allocation_weight) if row.allocation_weight is not None else None,
            "warning_badges": badges if isinstance(badges, list) else [],
        },
        "reasons": reasons,
        "features": features if isinstance(features, dict) else {},
        "feature_availability": int(row.feature_availability or 0),
        "radar": radar if isinstance(radar, dict) else {},
    }
