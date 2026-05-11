"""Baseline scoring engine — weighted normalized sum of 38 features.

TAD c01 §2 + TAD c02 §2 + PRD §4.2 group weights.

Pipeline cho mỗi mã (sau 4-round filter + feature_service):
1. Normalize 0-100 mỗi feature theo direction + (good, bad).
2. Trung bình normalized trong mỗi group → group_score.
3. Weighted sum group_score theo PRD §4.2 weights → ai_score 0-100.
4. Threshold (buy/hold_min từ Settings) → recommendation.
5. confidence_raw = pseudo từ độ phân cực của ai_score (xa 50 = tự tin hơn) — SRS không lock công thức cụ thể, baseline chỉ cần ổn định và backtest reproducible. XGBoost sau này thay bằng predict_proba thật.
6. reasons = top contributors + bottom draggers từ normalized scores.
"""

from app.constants.features import FEATURE_BY_ID, FEATURES, Direction, FeatureGroup
from app.engines.base import Reason, ScoringEngine, ScoringResult

# PRD §4.2 group weights — tổng = 100%
GROUP_WEIGHTS: dict[FeatureGroup, float] = {
    FeatureGroup.FUNDAMENTAL: 0.35,
    FeatureGroup.TECHNICAL: 0.20,
    FeatureGroup.MACRO: 0.15,
    FeatureGroup.REALESTATE: 0.22,
    FeatureGroup.SENTIMENT: 0.08,
}
assert abs(sum(GROUP_WEIGHTS.values()) - 1.0) < 1e-9


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _normalize(value: float, direction: Direction, good: float, bad: float, fid: str) -> float:
    """Normalize raw feature value → 0..100 score."""
    if direction == Direction.HIGHER_BETTER:
        if good == bad:
            return 50.0
        return _clamp((value - bad) / (good - bad) * 100.0, 0.0, 100.0)
    if direction == Direction.LOWER_BETTER:
        if fid == "F01" and value <= 0:
            return 0.0  # P/E ≤ 0 → score 0 (TAD c02)
        if good == bad:
            return 50.0
        return _clamp((bad - value) / (bad - good) * 100.0, 0.0, 100.0)
    # NEUTRAL — cho RSI và Bollinger Position
    if fid == "T03":  # RSI: center=50, score = 100 - abs(rsi-50)*2
        return _clamp(100.0 - abs(value - 50.0) * 2.0, 0.0, 100.0)
    if fid == "T05":  # Bollinger Pos: center=0.5, score = 100 - abs(pos-0.5)*200
        return _clamp(100.0 - abs(value - 0.5) * 200.0, 0.0, 100.0)
    return 50.0  # fallback neutral


class ScoringBaselineEngine(ScoringEngine):
    """Baseline weighted-normalize sum. Threshold-driven recommendation."""

    def __init__(self, buy_threshold: int = 75, hold_min_threshold: int = 45) -> None:
        self.buy_threshold = buy_threshold
        self.hold_min_threshold = hold_min_threshold

    def score(self, features: dict[str, float]) -> ScoringResult:
        # 1. Normalize từng feature có trong input
        normalized: dict[str, float] = {}
        for spec in FEATURES:
            if spec.id in features:
                normalized[spec.id] = _normalize(
                    features[spec.id], spec.direction, spec.good, spec.bad, spec.id
                )

        # 2. Group means
        radar: dict[str, float] = {}
        for group in FeatureGroup:
            ids = [s.id for s in FEATURES if s.group == group and s.id in normalized]
            if not ids:
                radar[group.value] = 0.0
                continue
            radar[group.value] = sum(normalized[i] for i in ids) / len(ids)

        # 3. Weighted sum → ai_score
        ai_score = sum(radar[g.value] * w for g, w in GROUP_WEIGHTS.items())
        ai_score = round(_clamp(ai_score, 0.0, 100.0), 2)

        # 4. Threshold → recommendation (ASCII keys per Recommendation enum)
        if ai_score >= self.buy_threshold:
            rec = "MUA"
        elif ai_score >= self.hold_min_threshold:
            rec = "GIU"
        else:
            rec = "BAN"

        # 5. confidence_raw — distance from threshold-neutral 50, scaled 50..100
        confidence_raw = round(50.0 + abs(ai_score - 50.0), 2)

        # 6. Reasons — top 3 boosters (≥70) + top 1 dragger (<35)
        boosters = sorted(
            (
                Reason(fid, round(s, 2), "boost")
                for fid, s in normalized.items()
                if s >= 70.0
            ),
            key=lambda r: r.score,
            reverse=True,
        )[:3]
        draggers = sorted(
            (
                Reason(fid, round(s, 2), "drag")
                for fid, s in normalized.items()
                if s < 35.0
            ),
            key=lambda r: r.score,
        )[:1]

        return ScoringResult(
            ai_score=ai_score,
            recommendation=rec,
            confidence_raw=confidence_raw,
            reasons=[*boosters, *draggers],
            radar={k: round(v, 2) for k, v in radar.items()},
        )


def _ensure_features_registered() -> None:
    """Sanity guard: every group must appear in GROUP_WEIGHTS."""
    for spec in FEATURES:
        assert spec.group in GROUP_WEIGHTS, f"Missing group weight for {spec.group}"
    assert FEATURE_BY_ID["F01"].direction == Direction.LOWER_BETTER


_ensure_features_registered()
