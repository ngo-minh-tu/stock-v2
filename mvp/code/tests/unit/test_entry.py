"""Entry engine — SRS f03 8 fixtures + AC enforcement."""

import pytest
from app.constants.enums import EntrySignal
from app.engines.base import EntryInput
from app.engines.entry_engine import EntryPointEngine


@pytest.fixture
def engine() -> EntryPointEngine:
    return EntryPointEngine()


def _input(**overrides) -> EntryInput:
    base = dict(
        recommendation="MUA",
        ai_score=78.0,
        confidence=70.0,
        upside_pct=15.0,
        nav_discount_pct=15.0,
        rsi=55.0,
        price=50.0,
        ma20=48.0,
        macd_histogram=0.5,
        macd_signal_cross=False,
        bollinger_upper=55.0,
        bollinger_lower=42.0,
        nearest_support=45.0,
        nearest_resistance=58.0,
        technical_features_available=8,
        technical_features_required=8,
    )
    base.update(overrides)
    return EntryInput(**base)


def test_tf_03_01_buy_strong(engine: EntryPointEngine):
    """MUA + upside 25% + nav 30% + RSI 52 + price>MA20 → BUY_STRONG."""
    res = engine.evaluate(_input(upside_pct=25.0, nav_discount_pct=30.0, rsi=52.0))
    assert res.signal == EntrySignal.BUY_STRONG.value


def test_tf_03_02_buy_now(engine: EntryPointEngine):
    """MUA + upside 15% + RSI 55 + price>MA20 + MACD>0 → BUY_NOW."""
    res = engine.evaluate(_input(upside_pct=15.0, rsi=55.0, macd_histogram=0.8))
    assert res.signal == EntrySignal.BUY_NOW.value


def test_tf_03_03_overbought_no_entry(engine: EntryPointEngine):
    """MUA + RSI 72 + price>BB_upper → NO_ENTRY (overbought)."""
    res = engine.evaluate(_input(rsi=72.0, price=60.0, bollinger_upper=55.0))
    assert res.signal == EntrySignal.NO_ENTRY.value
    assert res.reason_code == "OVERBOUGHT"


def test_tf_03_04_hold_no_entry(engine: EntryPointEngine):
    """rec=GIU → NO_ENTRY (Step 2 enforcement, AC-03-02 + AC-03-09)."""
    res = engine.evaluate(_input(recommendation="GIU"))
    assert res.signal == EntrySignal.NO_ENTRY.value
    assert res.reason_code == "NEGATIVE_RECOMMENDATION"


def test_step2_sell_no_entry(engine: EntryPointEngine):
    """rec=BAN → NO_ENTRY (Step 2 enforcement)."""
    res = engine.evaluate(_input(recommendation="BAN"))
    assert res.signal == EntrySignal.NO_ENTRY.value


def test_tf_03_05_wait_for_pullback(engine: EntryPointEngine):
    """MUA + RSI 63 + upside 12% (không match BUY_NOW vì nav<10 + technical not bullish) → WAIT_FOR_PULLBACK."""
    res = engine.evaluate(
        _input(
            upside_pct=12.0,
            nav_discount_pct=5.0,
            rsi=63.0,
            macd_histogram=-0.1,
            price=48.0,
            ma20=50.0,
        )
    )
    assert res.signal == EntrySignal.WAIT_FOR_PULLBACK.value


def test_tf_03_06_wait_for_breakout(engine: EntryPointEngine):
    """MUA + gần resistance ≤3% + RSI 50-65 → WAIT_FOR_BREAKOUT."""
    res = engine.evaluate(
        _input(
            upside_pct=8.0,
            nav_discount_pct=5.0,
            rsi=58.0,
            macd_histogram=0.05,
            price=57.0,
            nearest_resistance=58.0,
            ma20=55.0,
        )
    )
    assert res.signal == EntrySignal.WAIT_FOR_BREAKOUT.value


def test_tf_03_07_wait_for_confirmation(engine: EntryPointEngine):
    """MUA + MACD chưa cross + giá ≈ MA20 (≤3%) → WAIT_FOR_CONFIRMATION."""
    res = engine.evaluate(
        _input(
            upside_pct=5.0,
            nav_discount_pct=5.0,
            rsi=55.0,
            macd_histogram=0.05,
            macd_signal_cross=False,
            price=50.5,
            ma20=50.0,
            nearest_resistance=70.0,
        )
    )
    assert res.signal == EntrySignal.WAIT_FOR_CONFIRMATION.value


def test_tf_03_08_insufficient_data(engine: EntryPointEngine):
    """Thiếu ≥2 raw indicators → INSUFFICIENT_DATA (AC-03-01)."""
    res = engine.evaluate(_input(technical_features_available=5, technical_features_required=8))
    assert res.signal == EntrySignal.INSUFFICIENT_DATA.value
    assert res.reason_code == "INSUFFICIENT_INDICATORS"


def test_step9_fallback_buy_now(engine: EntryPointEngine):
    """MUA không match Step 3-8 → fallback BUY_NOW (AC-03-07)."""
    res = engine.evaluate(
        _input(
            upside_pct=5.0,
            nav_discount_pct=2.0,
            rsi=45.0,  # < 50 → không trigger Step 6 (need ≥ 50)
            macd_histogram=-0.1,
            macd_signal_cross=False,
            price=44.0,  # < ma20 → không trigger Step 5 technical_bullish
            ma20=46.0,
            nearest_resistance=70.0,
        )
    )
    assert res.signal == EntrySignal.BUY_NOW.value
    assert res.reason_code  # has reason


def test_priority_order_step4_wins(engine: EntryPointEngine):
    """BUY_STRONG match → KHÔNG check Step 5+ (AC-03-05)."""
    res = engine.evaluate(_input(upside_pct=25.0, nav_discount_pct=30.0, rsi=52.0, ma20=40.0, price=50.0))
    assert res.signal == EntrySignal.BUY_STRONG.value


def test_reason_code_uses_whitelist(engine: EntryPointEngine):
    """All reason codes in output phải nằm trong ENTRY_REASON_CODES (GUARD-02)."""
    from app.constants.reason_codes import ENTRY_REASON_CODES

    for tc in (
        _input(upside_pct=25.0, nav_discount_pct=30.0, rsi=52.0),
        _input(recommendation="GIU"),
        _input(rsi=72.0, price=60.0, bollinger_upper=55.0),
        _input(technical_features_available=2),
    ):
        res = engine.evaluate(tc)
        for token in res.reason_code.split("+"):
            assert token in ENTRY_REASON_CODES, f"{token} not in whitelist"
