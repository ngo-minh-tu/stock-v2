"""Compare 2 runs — TAD g02 §8.3 + SRS g03 §Q REC_RANK + §R buckets."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.constants.thresholds import REC_RANK, SCORE_DISTRIBUTION_BUCKETS
from app.models.run import ScreeningRun
from app.models.stock import Stock
from app.repositories import results_repo


def _delta(a: float, b: float) -> dict[str, float]:
    return {"a": round(a, 2), "b": round(b, 2), "delta": round(b - a, 2)}


def _avg_score(rows) -> float:
    scores = [float(r.ai_score) for r in rows if r.ai_score is not None]
    return sum(scores) / len(scores) if scores else 0.0


def _bucket_counts(rows) -> list[int]:
    counts = [0] * len(SCORE_DISTRIBUTION_BUCKETS)
    for r in rows:
        score = float(r.ai_score) if r.ai_score is not None else 0.0
        for i, (_, lo, hi) in enumerate(SCORE_DISTRIBUTION_BUCKETS):
            if lo <= score < hi:
                counts[i] += 1
                break
    return counts


def _direction(rec_a: str, rec_b: str) -> str:
    """REC_RANK heuristic: BAN=0, GIU=1, MUA=2. b > a = upgrade."""
    return "upgrade" if REC_RANK.get(rec_b, 1) > REC_RANK.get(rec_a, 1) else "downgrade"


def compute_compare(db: Session, run_a: ScreeningRun, run_b: ScreeningRun) -> dict:
    rows_a = results_repo.list_by_run(db, run_a.run_id)
    rows_b = results_repo.list_by_run(db, run_b.run_id)

    map_a = {r.ticker: r for r in rows_a}
    map_b = {r.ticker: r for r in rows_b}
    stocks_by_t = {s.ticker: s for s in db.query(Stock).all()}

    summary_diff = {
        "scored": _delta(len(rows_a), len(rows_b)),
        "buy_count": _delta(int(run_a.buy_count or 0), int(run_b.buy_count or 0)),
        "hold_count": _delta(int(run_a.hold_count or 0), int(run_b.hold_count or 0)),
        "sell_count": _delta(int(run_a.sell_count or 0), int(run_b.sell_count or 0)),
        "avg_score": _delta(round(_avg_score(rows_a), 2), round(_avg_score(rows_b), 2)),
        "duration_seconds": _delta(
            float(run_a.duration_seconds or 0.0),
            float(run_b.duration_seconds or 0.0),
        ),
    }

    # Recommendation changes — chỉ mã ở cả 2 runs có rec khác nhau
    common = set(map_a) & set(map_b)
    rec_changes = []
    for t in sorted(common):
        ra, rb = map_a[t], map_b[t]
        rec_a = ra.recommendation or "BAN"
        rec_b = rb.recommendation or "BAN"
        if rec_a == rec_b:
            continue
        s = stocks_by_t.get(t)
        rec_changes.append(
            {
                "ticker": t,
                "name": s.name if s else t,
                "rec_a": rec_a,
                "rec_b": rec_b,
                "score_a": round(float(ra.ai_score), 2) if ra.ai_score is not None else 0.0,
                "score_b": round(float(rb.ai_score), 2) if rb.ai_score is not None else 0.0,
                "direction": _direction(rec_a, rec_b),
            }
        )

    # New entries: ticker chỉ có ở B
    new_entries = []
    for t in sorted(set(map_b) - set(map_a)):
        rb = map_b[t]
        s = stocks_by_t.get(t)
        new_entries.append(
            {
                "ticker": t,
                "name": s.name if s else t,
                "rec": rb.recommendation or "BAN",
                "score": round(float(rb.ai_score), 2) if rb.ai_score is not None else 0.0,
            }
        )

    # Removed: ticker chỉ có ở A
    removed = []
    for t in sorted(set(map_a) - set(map_b)):
        ra = map_a[t]
        s = stocks_by_t.get(t)
        removed.append(
            {
                "ticker": t,
                "name": s.name if s else t,
                "rec": ra.recommendation or "BAN",
                "score": round(float(ra.ai_score), 2) if ra.ai_score is not None else 0.0,
            }
        )

    return {
        "summary_diff": summary_diff,
        "recommendation_changes": rec_changes,
        "new_entries": new_entries,
        "removed": removed,
        "score_distribution": {
            "buckets": [b[0] for b in SCORE_DISTRIBUTION_BUCKETS],
            "a_counts": _bucket_counts(rows_a),
            "b_counts": _bucket_counts(rows_b),
        },
    }
