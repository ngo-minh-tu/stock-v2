"""Entry Point Engine — deterministic rule logic.

SRS f03 + TAD c03 + cluster 3 lock. First-match-wins priority order Step 1-9.
Output reason_code dùng SRS g03 §N 15-enum whitelist (composed bằng `+`).

KHÔNG có anchor overrides — frontend prototype dùng anchors để demo 7-enum coverage,
backend MVP chỉ implement rule logic.
"""

from app.constants import reason_codes as rc
from app.constants.enums import EntrySignal
from app.engines.base import EntryInput, EntryResult


def _join(*codes: str) -> str:
    """Compose reason codes bằng `+` separator (TAD g03 §N format)."""
    valid = [c for c in codes if c in rc.ENTRY_REASON_CODES]
    return "+".join(valid) if valid else rc.WEAK_TREND


class EntryPointEngine:
    """Deterministic Step 1-9. KHÔNG abstract — logic cố định."""

    def evaluate(self, inp: EntryInput) -> EntryResult:
        used: list[str] = []

        # STEP 1 — INSUFFICIENT_DATA
        if inp.technical_features_available < (inp.technical_features_required - 1):
            return EntryResult(
                signal=EntrySignal.INSUFFICIENT_DATA.value,
                support_zone=inp.nearest_support,
                resistance_zone=inp.nearest_resistance,
                reason_code=rc.INSUFFICIENT_INDICATORS,
                raw_indicators_used=used,
            )

        # STEP 2 — rec≠MUA → NO_ENTRY (AC-03-02 / AC-03-09 enforce)
        if inp.recommendation != "MUA":
            return EntryResult(
                signal=EntrySignal.NO_ENTRY.value,
                support_zone=inp.nearest_support,
                resistance_zone=inp.nearest_resistance,
                reason_code=rc.NEGATIVE_RECOMMENDATION,
                raw_indicators_used=used,
            )

        used.extend(["rsi", "bollinger_upper", "ma20", "macd_histogram"])

        # STEP 3 — overbought override
        if inp.rsi > 70 and inp.price > inp.bollinger_upper:
            return EntryResult(
                signal=EntrySignal.NO_ENTRY.value,
                support_zone=inp.nearest_support,
                resistance_zone=inp.nearest_resistance,
                reason_code=rc.OVERBOUGHT,
                raw_indicators_used=used,
            )

        # STEP 4 — BUY_STRONG (5 conditions cùng lúc)
        if (
            inp.upside_pct >= 20
            and inp.nav_discount_pct >= 20
            and inp.rsi < 60
            and inp.price > inp.ma20
            and inp.rsi <= 70
        ):
            used.append("nav")
            return EntryResult(
                signal=EntrySignal.BUY_STRONG.value,
                support_zone=inp.nearest_support,
                resistance_zone=inp.nearest_resistance,
                reason_code=_join(rc.VALUATION_ATTRACTIVE, rc.BULLISH_TREND, rc.NAV_DISCOUNT),
                raw_indicators_used=used,
            )

        # STEP 5 — BUY_NOW
        valuation_ok = inp.nav_discount_pct >= 10
        technical_bullish = inp.price > inp.ma20 and inp.macd_histogram > 0
        if inp.upside_pct >= 10 and (valuation_ok or technical_bullish):
            tokens = [rc.VALUATION_ATTRACTIVE]
            if valuation_ok:
                tokens.append(rc.NAV_DISCOUNT)
            if technical_bullish:
                tokens.append(rc.BULLISH_TREND)
            return EntryResult(
                signal=EntrySignal.BUY_NOW.value,
                support_zone=inp.nearest_support,
                resistance_zone=inp.nearest_resistance,
                reason_code=_join(*tokens),
                raw_indicators_used=used,
            )

        # STEP 6 — WAIT_FOR_BREAKOUT
        if (
            inp.nearest_resistance > 0
            and inp.price >= inp.nearest_resistance * 0.97
            and 50 <= inp.rsi <= 65
            and inp.price < inp.nearest_resistance
        ):
            used.append("resistance")
            return EntryResult(
                signal=EntrySignal.WAIT_FOR_BREAKOUT.value,
                support_zone=inp.nearest_support,
                resistance_zone=inp.nearest_resistance,
                reason_code=_join(rc.NEAR_RESISTANCE, rc.AWAIT_BREAKOUT),
                raw_indicators_used=used,
            )

        # STEP 7 — WAIT_FOR_PULLBACK
        if inp.rsi > 60:
            return EntryResult(
                signal=EntrySignal.WAIT_FOR_PULLBACK.value,
                support_zone=inp.nearest_support,
                resistance_zone=inp.nearest_resistance,
                reason_code=_join(rc.OVERBOUGHT, rc.AWAIT_PULLBACK),
                raw_indicators_used=used,
            )

        # STEP 8 — WAIT_FOR_CONFIRMATION
        if inp.ma20 > 0 and not inp.macd_signal_cross and abs(inp.price - inp.ma20) / inp.ma20 < 0.03:
            return EntryResult(
                signal=EntrySignal.WAIT_FOR_CONFIRMATION.value,
                support_zone=inp.nearest_support,
                resistance_zone=inp.nearest_resistance,
                reason_code=_join(rc.WEAK_TREND, rc.AWAIT_CONFIRMATION),
                raw_indicators_used=used,
            )

        # STEP 9 — fallback BUY_NOW (AC-03-07 đảm bảo MUA luôn có signal)
        return EntryResult(
            signal=EntrySignal.BUY_NOW.value,
            support_zone=inp.nearest_support,
            resistance_zone=inp.nearest_resistance,
            reason_code=_join(rc.BULLISH_TREND),
            raw_indicators_used=used,
        )
