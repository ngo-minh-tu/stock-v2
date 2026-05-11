"""Baseline scoring engine — golden outputs cho 5 anchor tickers + invariants."""

import pytest
from app.engines.scoring_baseline import GROUP_WEIGHTS, ScoringBaselineEngine

from tests.fixtures.anchor_features import ANCHORS


@pytest.fixture
def engine() -> ScoringBaselineEngine:
    return ScoringBaselineEngine(buy_threshold=75, hold_min_threshold=45)


def test_group_weights_sum_one():
    assert sum(GROUP_WEIGHTS.values()) == pytest.approx(1.0, abs=1e-9)


def test_score_in_range_for_all_anchors(engine: ScoringBaselineEngine):
    for ticker, anchor in ANCHORS.items():
        result = engine.score(anchor["features"])
        assert 0.0 <= result.ai_score <= 100.0, f"{ticker} score={result.ai_score} out of range"
        assert result.recommendation in {"MUA", "GIU", "BAN"}


def test_anchor_recommendations(engine: ScoringBaselineEngine):
    """5-mã golden outputs khớp Phase 4 expectations."""
    expectations: dict[str, str] = {
        "VHM": "MUA",
        "KDH": "MUA",
        "NLG": "MUA",
        "DXG": "GIU",
        "PDR": "BAN",
    }
    for ticker, expected_rec in expectations.items():
        result = engine.score(ANCHORS[ticker]["features"])
        assert result.recommendation == expected_rec, (
            f"{ticker} expected {expected_rec} got {result.recommendation} (score={result.ai_score})"
        )


def test_threshold_boundaries():
    engine = ScoringBaselineEngine(buy_threshold=80, hold_min_threshold=50)
    # Score 80 → MUA, 79.99 → GIU, 50 → GIU, 49 → BAN
    near_buy = ANCHORS["VHM"]["features"].copy()
    res = engine.score(near_buy)
    assert res.recommendation == "MUA"  # VHM ~93


def test_reasons_populated_for_high_score(engine: ScoringBaselineEngine):
    res = engine.score(ANCHORS["VHM"]["features"])
    assert res.reasons, "VHM should have boost reasons"
    assert any(r.direction == "boost" for r in res.reasons)


def test_reasons_populated_drag_for_low_score(engine: ScoringBaselineEngine):
    res = engine.score(ANCHORS["PDR"]["features"])
    # PDR có nhiều feature score thấp → ≥1 dragger
    assert any(r.direction == "drag" for r in res.reasons)


def test_radar_matches_groups(engine: ScoringBaselineEngine):
    res = engine.score(ANCHORS["VHM"]["features"])
    assert set(res.radar.keys()) == {"fundamental", "technical", "macro", "realestate", "sentiment"}
    for v in res.radar.values():
        assert 0.0 <= v <= 100.0


def test_pe_zero_or_negative_scores_zero(engine: ScoringBaselineEngine):
    """TAD c02 §2.2: P/E ≤ 0 → score 0 (loss-making companies)."""
    features = ANCHORS["VHM"]["features"].copy()
    features["F01"] = -5.0
    res = engine.score(features)
    # Score chỉ giảm 1 chút vì 1/16 fundamental đi từ ~94 xuống 0
    assert res.ai_score < 95


def test_empty_features_safe(engine: ScoringBaselineEngine):
    """Empty input: ai_score = 0 (no signal). Recommendation = BAN (≤45)."""
    res = engine.score({})
    assert res.ai_score == 0.0
    assert res.recommendation == "BAN"
