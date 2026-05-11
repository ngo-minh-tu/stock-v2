"""Screening orchestrator — SRS f01 Step 1-14 + TAD g01 §2.

Pipeline trên 81 mã ACTIVE:
1. PENDING → CHECKING_DATA: load whitelist + cache freshness check
2. SCREENING: 4-round filter pipeline (filter_service)
3. SCORING: cho mỗi survivor, tính 38 features (feature_service) → ai_score (scoring_baseline)
            → target_3m (price_baseline) → entry signal (entry_engine) → risk (risk_service).
            Bulk insert results + excluded.
4. Mark COMPLETED hoặc COMPLETED_WITH_WARNINGS (data_from_cache true / imputed features / engine fallback).

Background driver run trên FastAPI BackgroundTasks (threadpool, KHÔNG asyncio).
Open SessionLocal riêng trong background — không pass HTTP request session.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from datetime import UTC, datetime

from app.constants.enums import Recommendation, RunStatus
from app.constants.sources import VNSTOCK_FINANCIAL, VNSTOCK_PRICE
from app.crawlers import cache_manager
from app.db.session import SessionLocal
from app.engines.base import EntryInput
from app.engines.entry_engine import EntryPointEngine
from app.engines.price_baseline import PriceBaselineEngine
from app.engines.scoring_baseline import ScoringBaselineEngine
from app.job_lock import job_lock
from app.repositories import (
    excluded_repo,
    financial_repo,
    macro_repo,
    price_repo,
    results_repo,
    screening_repo,
    stock_repo,
)
from app.services.feature_service import FeatureService
from app.services.filter_service import StockData, run_filters
from app.services.risk_service import (
    allocate_capital,
    compute_risk,
)

logger = logging.getLogger(__name__)


MODEL_VERSION = "baseline_v2"


@dataclass(slots=True)
class _RunContext:
    run_id: str
    total_capital: float
    skip_allocation: bool
    started_at: datetime
    started_perf: float


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _load_settings_thresholds(db) -> tuple[int, int, int]:
    """Load buy/hold thresholds + settings_version từ DB. Fallback defaults nếu chưa seed."""
    from app.models import Settings as SettingsRow

    s = db.get(SettingsRow, 1)
    if s is None:
        return 75, 45, 1
    return int(s.buy_threshold), int(s.hold_min_threshold), int(s.version)


def _data_from_cache(db) -> bool:
    """True nếu vnstock_price hoặc vnstock_financial đang STALE → run dùng cache cũ."""
    return cache_manager.is_stale(db, VNSTOCK_PRICE.key) or cache_manager.is_stale(db, VNSTOCK_FINANCIAL.key)


def _update_progress(run_id: str, *, status: str, step: str, percent: int, message: str = "") -> None:
    """Atomic: write status + progress vào DB + job_lock registry. Đọc bởi GET /runs/{id}/status."""
    job_lock.update(run_id, status=status, progress=percent, message=message)
    with SessionLocal() as db:
        screening_repo.update_status(
            db, run_id, status=status, current_step=step, progress_percent=percent
        )
        db.commit()


def _build_filter_inputs(db, tickers: list[str]) -> list[StockData]:
    """Bundle StockData cho từng mã: stock + ≤8Q financials (latest first) + ≤400 daily prices."""
    from app.models.stock import Stock

    out: list[StockData] = []
    for t in tickers:
        stock = db.get(Stock, t)
        if stock is None:
            continue
        fins = financial_repo.list_latest(db, t, limit=8)
        prices = price_repo.list_recent(db, t, limit=400)
        out.append(StockData(stock=stock, financials=fins, prices=prices))
    return out


def _score_one(
    *,
    ticker: str,
    data: StockData,
    macro: dict[str, float],
    feature_service: FeatureService,
    scoring: ScoringBaselineEngine,
    pricing: PriceBaselineEngine,
    entry: EntryPointEngine,
) -> dict | None:
    """Chạy full pipeline 1 mã. Return dict ready cho results_repo.bulk_insert, hoặc None nếu data corrupt."""
    if not data.prices or not data.financials:
        return None
    bundle = feature_service.compute(
        ticker=ticker,
        financials=data.financials,
        prices=data.prices,
        macro=macro,
        legal_risk=3.0,
    )

    score_res = scoring.score(bundle.features)

    closes = [float(p.close) for p in data.prices if p.close is not None]
    if not closes:
        return None
    price_res = pricing.predict(ticker=ticker, prices=closes, features=bundle.features)

    risk = compute_risk(
        current_price=closes[-1],
        confidence_raw=score_res.confidence_raw,
        features=bundle.features,
        buy_price=None,
    )

    raw = bundle.raw_indicators
    entry_inp = EntryInput(
        recommendation=score_res.recommendation,
        ai_score=score_res.ai_score,
        confidence=risk.confidence,
        upside_pct=price_res.upside_pct,
        nav_discount_pct=bundle.features.get("R04", 0.0) * 100.0,  # decimal → percent for entry rules
        rsi=raw.get("rsi", 50.0),
        price=closes[-1],
        ma20=raw.get("sma20", closes[-1]),
        macd_histogram=raw.get("macd_histogram", 0.0),
        macd_signal_cross=bool(raw.get("macd_signal_cross", 0.0) > 0.5),
        bollinger_upper=raw.get("bb_upper", closes[-1] * 1.05),
        bollinger_lower=raw.get("bb_lower", closes[-1] * 0.95),
        nearest_support=raw.get("support", closes[-1] * 0.95),
        nearest_resistance=raw.get("resistance", closes[-1] * 1.05),
        technical_features_available=sum(1 for k in ("sma20", "sma50", "sma200", "ema12", "ema26", "bb_upper", "bb_lower", "macd_signal_line") if k in raw),
    )
    entry_res = entry.evaluate(entry_inp)

    radar = score_res.radar
    reasons = [{"feature_id": r.feature_id, "score": r.score, "direction": r.direction} for r in score_res.reasons]

    return {
        "ticker": ticker,
        "ai_score": score_res.ai_score,
        "recommendation": score_res.recommendation,
        "confidence_raw": score_res.confidence_raw,
        "confidence_penalty": risk.confidence_penalty,
        "confidence": risk.confidence,
        "target_price_3m": price_res.target_price_3m,
        "current_price": closes[-1],
        "upside_pct": price_res.upside_pct,
        "entry_signal": entry_res.signal,
        "entry_reason_code": entry_res.reason_code,
        "support_zone": entry_res.support_zone,
        "resistance_zone": entry_res.resistance_zone,
        "stop_loss_price": risk.stop_loss_price,
        "warning_badges_json": json.dumps(risk.warning_badges),
        "reasons_json": json.dumps(reasons, ensure_ascii=False),
        "feature_values_json": json.dumps(bundle.features),
        "feature_availability": bundle.availability,
        "radar_json": json.dumps(radar),
        # allocation/imputed/buy_price filled sau khi compute allocation
    }


def _apply_allocation(
    rows: list[dict],
    *,
    total_capital: float,
    skip_allocation: bool,
) -> None:
    """Mutate rows[] in-place: gắn allocation_amount + allocation_weight cho mã MUA."""
    if skip_allocation or total_capital <= 0:
        for r in rows:
            r["allocation_amount"] = None
            r["allocation_weight"] = None
        return

    buys = [(r["ticker"], r["ai_score"]) for r in rows if r["recommendation"] == Recommendation.MUA.value]
    res = allocate_capital(buys, total_capital)
    by_ticker = {it.ticker: it for it in res.items}
    for r in rows:
        item = by_ticker.get(r["ticker"])
        if item is not None:
            r["allocation_amount"] = float(item.amount)
            r["allocation_weight"] = item.weight
        else:
            r["allocation_amount"] = None
            r["allocation_weight"] = None


def _summarize_warnings(*, data_from_cache: bool, imputed_count: int, telegram_error: str | None) -> list[str]:
    warnings: list[str] = []
    if data_from_cache:
        warnings.append("DATA_FROM_CACHE")
    if imputed_count > 0:
        warnings.append("IMPUTED_FEATURES")
    if telegram_error:
        warnings.append("TELEGRAM_FAILED")
    return warnings


def _final_status(warnings: list[str]) -> RunStatus:
    return RunStatus.COMPLETED_WITH_WARNINGS if warnings else RunStatus.COMPLETED


# ---------------------------------------------------------------------------
# Public driver
# ---------------------------------------------------------------------------

def run_screening(
    run_id: str,
    *,
    total_capital: float,
    skip_allocation: bool,
) -> None:
    """Background driver — gọi từ FastAPI BackgroundTasks. Không return value."""
    started_at = _now_utc()
    started_perf = time.perf_counter()
    ctx = _RunContext(
        run_id=run_id,
        total_capital=total_capital,
        skip_allocation=skip_allocation,
        started_at=started_at,
        started_perf=started_perf,
    )
    logger.info("[%s] screening start total_capital=%s", run_id, total_capital)

    try:
        # Phase 1: CHECKING_DATA — load whitelist + cache check
        _update_progress(run_id, status=RunStatus.CHECKING_DATA.value, step="Đang tải dữ liệu", percent=5)
        with SessionLocal() as db:
            tickers = stock_repo.list_active_tickers(db)
            data_cache = _data_from_cache(db)
            buy_th, hold_th, settings_version = _load_settings_thresholds(db)
            macro = macro_repo.all_latest(db)
            inputs = _build_filter_inputs(db, tickers)

        screening_repo_run_update_total = len(inputs)

        # Phase 2: SCREENING — 4 rounds
        _update_progress(run_id, status=RunStatus.SCREENING.value, step="Đang lọc 4 vòng", percent=15)
        filter_res = run_filters(inputs)

        with SessionLocal() as db:
            screening_repo.update_counts(
                db,
                run_id,
                total_input=screening_repo_run_update_total,
                after_round_1=filter_res.after_round_1,
                after_round_2=filter_res.after_round_2,
                after_round_3=filter_res.after_round_3,
                after_round_4=filter_res.after_round_4,
                data_from_cache=data_cache,
            )
            excluded_rows = [
                {
                    "run_id": run_id,
                    "ticker": rec.ticker,
                    "excluded_round": rec.excluded_round,
                    "reason": rec.reason,
                    "reason_code": rec.reason_code,
                }
                for rec in filter_res.excluded
            ]
            excluded_repo.bulk_insert(db, excluded_rows)
            db.commit()

        # Phase 3: SCORING — feature → score → price → entry → risk
        _update_progress(run_id, status=RunStatus.SCORING.value, step="Đang chấm điểm", percent=30)
        scoring = ScoringBaselineEngine(buy_threshold=buy_th, hold_min_threshold=hold_th)
        pricing = PriceBaselineEngine()
        entry = EntryPointEngine()
        feature_service = FeatureService()

        survivors = [d for d in inputs if d.stock.ticker in set(filter_res.kept)]
        scored: list[dict] = []
        imputed_count = 0

        for i, sd in enumerate(survivors):
            row = _score_one(
                ticker=sd.stock.ticker,
                data=sd,
                macro=macro,
                feature_service=feature_service,
                scoring=scoring,
                pricing=pricing,
                entry=entry,
            )
            if row is None:
                continue
            row["run_id"] = run_id
            scored.append(row)
            if row["feature_availability"] < 38:
                imputed_count += 1
            if (i + 1) % 5 == 0 or (i + 1) == len(survivors):
                pct = 30 + int(((i + 1) / max(len(survivors), 1)) * 65)
                _update_progress(
                    run_id,
                    status=RunStatus.SCORING.value,
                    step=f"Đang chấm điểm {i + 1}/{len(survivors)}",
                    percent=min(95, pct),
                )

        # Allocation áp dụng sau khi đã có toàn bộ rows MUA
        _apply_allocation(scored, total_capital=total_capital, skip_allocation=skip_allocation)

        # Bulk insert results + counts + warnings
        buy_count = sum(1 for r in scored if r["recommendation"] == Recommendation.MUA.value)
        hold_count = sum(1 for r in scored if r["recommendation"] == Recommendation.GIU.value)
        sell_count = sum(1 for r in scored if r["recommendation"] == Recommendation.BAN.value)
        warnings = _summarize_warnings(
            data_from_cache=data_cache,
            imputed_count=imputed_count,
            telegram_error=None,  # Phase 8 wire telegram
        )

        with SessionLocal() as db:
            results_repo.bulk_insert(db, scored)
            screening_repo.update_counts(
                db,
                run_id,
                scored_count=len(scored),
                buy_count=buy_count,
                hold_count=hold_count,
                sell_count=sell_count,
                warnings_json=json.dumps(warnings),
            )
            duration = time.perf_counter() - ctx.started_perf
            screening_repo.mark_completed(
                db,
                run_id,
                status=_final_status(warnings).value,
                completed_at=_now_utc(),
                duration_seconds=round(duration, 3),
            )
            db.commit()

        job_lock.release(run_id, status=_final_status(warnings).value)
        logger.info(
            "[%s] screening done — scored=%d buy=%d hold=%d sell=%d duration=%.2fs",
            run_id, len(scored), buy_count, hold_count, sell_count, duration,
        )
    except Exception as e:
        logger.exception("[%s] screening crashed", run_id)
        try:
            duration = time.perf_counter() - ctx.started_perf
            with SessionLocal() as db:
                screening_repo.update_status(db, run_id, run_error=str(e))
                screening_repo.mark_completed(
                    db,
                    run_id,
                    status=RunStatus.FAILED.value,
                    completed_at=_now_utc(),
                    duration_seconds=round(duration, 3),
                )
                db.commit()
        finally:
            job_lock.release(run_id, status=RunStatus.FAILED.value, error=str(e))


__all__ = ["run_screening", "MODEL_VERSION"]
