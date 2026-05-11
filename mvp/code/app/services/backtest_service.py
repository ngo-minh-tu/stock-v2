"""Backtest service — TAD g02 §8.5-8.6 + SRS f12 UC-12-03 + cluster-5-summary.

Mock heuristic (NOT strict per PRD §4.5 — backend trade-off documented Phase 8):
- MUA correct: actual_return_3m > 0
- GIU correct: BACKTEST_HOLD_RETURN_MIN ≤ actual_return_3m ≤ BACKTEST_HOLD_RETURN_MAX
- BAN correct: actual_return_3m < 0

Universe: scored results của latest COMPLETED run (~70-78 mã sau 4-round filter), KHÔNG full
81-ticker whitelist (TAD §8.6 explicit "total_count = scored_count latest run, NOT 81").

State machine (4 transitions ~1.2s mock total): PENDING → RUNNING → RUNNING → COMPLETED|FAILED.
"""

from __future__ import annotations

import math
import random
import time
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.constants.error_codes import (
    ERR_BACKTEST_NO_BASELINE_RUN,
    ERR_BACKTEST_PERIOD_INVALID,
)
from app.constants.thresholds import (
    BACKTEST_HOLD_RETURN_MAX,
    BACKTEST_HOLD_RETURN_MIN,
    BACKTEST_MOCK_STEP_DELAY_S,
)
from app.core.errors import AppError
from app.db.session import SessionLocal
from app.job_lock import job_lock
from app.repositories import backtest_repo, results_repo, screening_repo


def validate_period(period_from: date, period_to: date) -> None:
    today = datetime.now(UTC).date()
    if period_from >= period_to:
        raise AppError(
            ERR_BACKTEST_PERIOD_INVALID,
            "period_from phải nhỏ hơn period_to",
            http_status=400,
        )
    if period_to > today:
        raise AppError(
            ERR_BACKTEST_PERIOD_INVALID,
            "period_to không thể ở tương lai",
            http_status=400,
        )


def _is_correct(rec: str, actual_return: float) -> bool:
    if rec == "MUA":
        return actual_return > 0
    if rec == "GIU":
        return BACKTEST_HOLD_RETURN_MIN <= actual_return <= BACKTEST_HOLD_RETURN_MAX
    if rec == "BAN":
        return actual_return < 0
    return False


def _build_roi_curve(period_from: date, period_to: date, port_total: float, vn_total: float) -> list[dict]:
    """9-26 weekly points trải đều giữa period_from + period_to. Sin-wobble cộng dồn về terminal."""
    days = (period_to - period_from).days
    weeks = max(9, min(26, days // 7))
    curve: list[dict] = []
    for i in range(weeks):
        # Cumulative growth → ramp linearly với wobble nhỏ
        ramp = (i + 1) / weeks
        wobble = math.sin((i + 1) * 0.7) * 1.2
        d = period_from + timedelta(days=int(days * ramp))
        # ISO week label (year-Wweek)
        iso_year, iso_week, _ = d.isocalendar()
        curve.append(
            {
                "week": f"{iso_year}-W{iso_week:02d}",
                "portfolio": round(port_total * ramp + wobble, 2),
                "vnindex": round(vn_total * ramp + wobble * 0.6, 2),
            }
        )
    return curve


def _generate_results(scored_rows: list, seed: int) -> list[dict]:
    """Mock per-ticker results — heuristic correctness based on actual_return_3m mock.

    `target_price_3m` (ngàn đồng saved by Phase 5 raw VND ÷1000 by results_service) is
    treated as predicted_price. actual_price = predicted * (1 ± errPct).
    actual_return_3m mocked from upside_pct + noise.
    """
    rng = random.Random(seed)
    rows: list[dict] = []
    for r in scored_rows:
        rec = (r.recommendation or "GIU").upper()
        # Phase 5 stored raw VND in DB; convert to ngàn đồng for output (TAD g02 §M)
        predicted_raw = float(r.target_price_3m or 0.0)
        predicted_ngan = round(predicted_raw / 1000.0, 2) if predicted_raw > 1000 else round(predicted_raw, 2)
        # Mock error: rec MUA correct mostly small error; rec BAN/GIU larger spread
        err_base = 0.05 if rec == "MUA" else 0.12
        err_pct = abs(rng.gauss(0.0, err_base))
        sign = 1 if rng.random() > 0.5 else -1
        actual_ngan = round(predicted_ngan * (1 + sign * err_pct), 2)
        price_error_pct = round(abs(actual_ngan - predicted_ngan) / max(predicted_ngan, 0.01) * 100.0, 2)
        # Mock actual_return_3m theo upside_pct + noise; bias by recommendation
        upside = float(r.upside_pct or 0.0)
        if rec == "MUA":
            ret = upside * rng.uniform(0.5, 1.2) + rng.gauss(0, 3)
        elif rec == "BAN":
            ret = -abs(upside) * rng.uniform(0.3, 0.9) + rng.gauss(0, 5)
        else:
            ret = rng.gauss(2.0, 5.0)
        actual_return = round(ret, 2)
        rows.append(
            {
                "ticker": r.ticker,
                "predicted_recommendation": rec,
                "predicted_price": predicted_ngan,
                "actual_price": actual_ngan,
                "price_error_pct": price_error_pct,
                "actual_return_3m": actual_return,
                "recommendation_correct": _is_correct(rec, actual_return),
            }
        )
    return rows


def start_backtest(
    db: Session,
    *,
    period_from: date,
    period_to: date,
) -> int:
    """Validate + create DB row + acquire job_lock. Returns backtest_id.

    Caller (router) tự append BG task để thực thi mock pipeline.
    """
    validate_period(period_from, period_to)

    # Verify có baseline run COMPLETED — universe nguồn cho backtest
    latest = screening_repo.latest_completed(db)
    if latest is None:
        raise AppError(
            ERR_BACKTEST_NO_BASELINE_RUN,
            "Cần ít nhất 1 run COMPLETED trước khi backtest",
            http_status=400,
        )

    now = datetime.now(UTC).replace(tzinfo=None)
    row = backtest_repo.create_run(
        db,
        period_from=period_from,
        period_to=period_to,
        started_at=now,
        status="PENDING",
    )
    db.commit()
    return int(row.id)


def run_backtest(backtest_id: int, *, baseline_run_id: str) -> None:
    """Background task — mock state machine + compute + persist."""
    job_key = f"backtest_{backtest_id}"
    if not job_lock.try_acquire(job_key, "backtest"):
        # Another job has lock — mark FAILED and exit
        with SessionLocal() as db:
            backtest_repo.mark_failed(db, backtest_id, completed_at=datetime.now(UTC).replace(tzinfo=None))
            db.commit()
        return

    try:
        # Stage RUNNING — simulated work
        with SessionLocal() as db:
            backtest_repo.update_status(db, backtest_id, status="RUNNING")
            db.commit()
        time.sleep(BACKTEST_MOCK_STEP_DELAY_S)
        time.sleep(BACKTEST_MOCK_STEP_DELAY_S)

        # Compute results from latest baseline run
        with SessionLocal() as db:
            row = backtest_repo.get(db, backtest_id)
            if row is None:
                return
            scored = results_repo.list_by_run(db, baseline_run_id)
            if not scored:
                backtest_repo.mark_failed(db, backtest_id, completed_at=datetime.now(UTC).replace(tzinfo=None))
                db.commit()
                return

            mock_rows = _generate_results(scored, seed=backtest_id)
            backtest_repo.insert_results(db, backtest_id, mock_rows)

            # Aggregate metrics
            total = len(mock_rows)
            correct = sum(1 for r in mock_rows if r["recommendation_correct"])
            accuracy = round(correct / total, 4) if total else 0.0
            price_err_mean = round(sum(r["price_error_pct"] for r in mock_rows) / total, 2) if total else 0.0
            # Portfolio ROI: weighted mean actual_return on MUA picks (allocation-weighted simplified)
            mua_rows = [r for r in mock_rows if r["predicted_recommendation"] == "MUA"]
            port_roi = (
                round(sum(r["actual_return_3m"] for r in mua_rows) / len(mua_rows), 2)
                if mua_rows
                else 0.0
            )
            # VN-Index ROI: heuristic — slightly less than mean of all return
            vn_roi = round(sum(r["actual_return_3m"] for r in mock_rows) / total - 1.5, 2) if total else 0.0
            alpha = round(port_roi - vn_roi, 2)

            backtest_repo.mark_completed(
                db,
                backtest_id,
                completed_at=datetime.now(UTC).replace(tzinfo=None),
                recommendation_accuracy=accuracy,
                price_error_mean=price_err_mean,
                portfolio_roi=port_roi,
                vnindex_roi=vn_roi,
                alpha=alpha,
            )
            db.commit()
    except Exception as exc:  # noqa: BLE001
        with SessionLocal() as db:
            backtest_repo.mark_failed(db, backtest_id, completed_at=datetime.now(UTC).replace(tzinfo=None))
            db.commit()
        job_lock.release(job_key, status="FAILED", error=str(exc))
        return
    finally:
        if job_lock.active_job == job_key:
            job_lock.release(job_key, status="COMPLETED")


def get_metrics(db: Session, row, results: list[dict]) -> dict:
    """Build BacktestMetricsResponse data dict from DB row + results."""
    correct = sum(1 for r in results if r["recommendation_correct"])
    total = len(results)
    return {
        "backtest_id": int(row.id),
        "period_from": row.period_from.isoformat() if row.period_from else "",
        "period_to": row.period_to.isoformat() if row.period_to else "",
        "status": row.status,
        "recommendation_accuracy": float(row.recommendation_accuracy or 0.0),
        "price_error_mean": float(row.price_error_mean or 0.0),
        "portfolio_roi": float(row.portfolio_roi or 0.0),
        "vnindex_roi": float(row.vnindex_roi or 0.0),
        "alpha": float(row.alpha or 0.0),
        "correct_count": correct,
        "total_count": total,
        "roi_curve": _build_roi_curve(
            row.period_from,
            row.period_to,
            float(row.portfolio_roi or 0.0),
            float(row.vnindex_roi or 0.0),
        ),
    }
