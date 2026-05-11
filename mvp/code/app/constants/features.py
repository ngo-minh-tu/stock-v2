"""38 feature IDs + normalization spec — TAD c02 §2.

Group totals:
- F01-F16: Fundamental (16)
- T01-T09: Technical (9)
- M01-M05: Macro (5)
- R01-R05: Real Estate (5)
- S01-S03: Sentiment (3)
Total: 38
"""

from dataclasses import dataclass
from enum import StrEnum


class FeatureGroup(StrEnum):
    FUNDAMENTAL = "fundamental"
    TECHNICAL = "technical"
    MACRO = "macro"
    REALESTATE = "realestate"
    SENTIMENT = "sentiment"


class Direction(StrEnum):
    HIGHER_BETTER = "higher_better"
    LOWER_BETTER = "lower_better"
    NEUTRAL = "neutral"  # T03 RSI, T05 Bollinger


@dataclass(frozen=True, slots=True)
class FeatureSpec:
    id: str
    group: FeatureGroup
    label: str
    direction: Direction
    good: float
    bad: float
    notes: str = ""


FEATURES: tuple[FeatureSpec, ...] = (
    # Fundamental F01-F16
    FeatureSpec("F01", FeatureGroup.FUNDAMENTAL, "P/E", Direction.LOWER_BETTER, 8.0, 25.0, "P/E ≤ 0 → score 0"),
    FeatureSpec("F02", FeatureGroup.FUNDAMENTAL, "P/B", Direction.LOWER_BETTER, 1.0, 3.0),
    FeatureSpec("F03", FeatureGroup.FUNDAMENTAL, "ROE", Direction.HIGHER_BETTER, 0.20, 0.0),
    FeatureSpec("F04", FeatureGroup.FUNDAMENTAL, "ROA", Direction.HIGHER_BETTER, 0.08, 0.0),
    FeatureSpec("F05", FeatureGroup.FUNDAMENTAL, "EPS", Direction.HIGHER_BETTER, 5000.0, 0.0, "VND/share"),
    FeatureSpec("F06", FeatureGroup.FUNDAMENTAL, "D/E", Direction.LOWER_BETTER, 0.5, 3.0),
    FeatureSpec("F07", FeatureGroup.FUNDAMENTAL, "Net Margin", Direction.HIGHER_BETTER, 0.20, 0.0),
    FeatureSpec("F08", FeatureGroup.FUNDAMENTAL, "Rev Growth", Direction.HIGHER_BETTER, 0.30, -0.10),
    FeatureSpec("F09", FeatureGroup.FUNDAMENTAL, "Profit Growth", Direction.HIGHER_BETTER, 0.30, -0.20),
    FeatureSpec("F10", FeatureGroup.FUNDAMENTAL, "OCF", Direction.HIGHER_BETTER, 5000.0, 0.0, "tỷ VND, positive = good"),
    FeatureSpec("F11", FeatureGroup.FUNDAMENTAL, "Current Ratio", Direction.HIGHER_BETTER, 2.0, 0.8),
    FeatureSpec("F12", FeatureGroup.FUNDAMENTAL, "Advances", Direction.HIGHER_BETTER, 0.20, -0.10, "YoY change %"),
    FeatureSpec("F13", FeatureGroup.FUNDAMENTAL, "OCF/NI", Direction.HIGHER_BETTER, 1.0, 0.0),
    FeatureSpec("F14", FeatureGroup.FUNDAMENTAL, "Inventory/TA", Direction.LOWER_BETTER, 0.20, 0.70),
    FeatureSpec("F15", FeatureGroup.FUNDAMENTAL, "Inv Turnover", Direction.HIGHER_BETTER, 0.8, 0.1),
    FeatureSpec("F16", FeatureGroup.FUNDAMENTAL, "Inv vs Rev Growth", Direction.LOWER_BETTER, -0.10, 0.20, "inv_growth - rev_growth"),
    # Technical T01-T09
    FeatureSpec("T01", FeatureGroup.TECHNICAL, "MA Trend", Direction.HIGHER_BETTER, 100.0, 0.0, "Already 0-100"),
    FeatureSpec("T02", FeatureGroup.TECHNICAL, "EMA Momentum", Direction.HIGHER_BETTER, 0.05, -0.05),
    FeatureSpec("T03", FeatureGroup.TECHNICAL, "RSI", Direction.NEUTRAL, 50.0, 0.0, "Score = 100 - abs(rsi-50)*2"),
    FeatureSpec("T04", FeatureGroup.TECHNICAL, "MACD Hist", Direction.HIGHER_BETTER, 2.0, -2.0),
    FeatureSpec("T05", FeatureGroup.TECHNICAL, "Bollinger Pos", Direction.NEUTRAL, 0.5, 0.0, "Score = 100 - abs(pos-0.5)*200"),
    FeatureSpec("T06", FeatureGroup.TECHNICAL, "Avg Volume 20D", Direction.HIGHER_BETTER, 2_000_000.0, 100_000.0),
    FeatureSpec("T07", FeatureGroup.TECHNICAL, "Return 1M", Direction.HIGHER_BETTER, 0.15, -0.15),
    FeatureSpec("T08", FeatureGroup.TECHNICAL, "Return 3M", Direction.HIGHER_BETTER, 0.25, -0.20),
    FeatureSpec("T09", FeatureGroup.TECHNICAL, "Return 6M", Direction.HIGHER_BETTER, 0.40, -0.30),
    # Macro M01-M05
    FeatureSpec("M01", FeatureGroup.MACRO, "Interest Rate", Direction.LOWER_BETTER, 0.04, 0.08, "Thấp tốt cho BĐS"),
    FeatureSpec("M02", FeatureGroup.MACRO, "Credit Growth", Direction.HIGHER_BETTER, 0.15, 0.0),
    FeatureSpec("M03", FeatureGroup.MACRO, "CPI", Direction.LOWER_BETTER, 0.02, 0.06),
    FeatureSpec("M04", FeatureGroup.MACRO, "FDI", Direction.HIGHER_BETTER, 5_000_000_000.0, 1_000_000_000.0, "USD/year"),
    FeatureSpec("M05", FeatureGroup.MACRO, "VN-Index", Direction.HIGHER_BETTER, 1400.0, 900.0),
    # Real Estate R01-R05
    FeatureSpec("R01", FeatureGroup.REALESTATE, "Land Bank", Direction.HIGHER_BETTER, 5000.0, 100.0, "ha"),
    FeatureSpec("R02", FeatureGroup.REALESTATE, "Projects", Direction.HIGHER_BETTER, 8.0, 1.0),
    FeatureSpec("R03", FeatureGroup.REALESTATE, "NAV", Direction.HIGHER_BETTER, 50000.0, 10000.0, "VND/share"),
    FeatureSpec("R04", FeatureGroup.REALESTATE, "NAV Discount", Direction.HIGHER_BETTER, 0.40, -0.10, "(NAV-price)/NAV"),
    FeatureSpec("R05", FeatureGroup.REALESTATE, "Legal Risk", Direction.LOWER_BETTER, 1.0, 5.0, "1=clean, 5=severe"),
    # Sentiment S01-S03
    FeatureSpec("S01", FeatureGroup.SENTIMENT, "Sentiment Avg", Direction.HIGHER_BETTER, 0.8, -0.8),
    FeatureSpec("S02", FeatureGroup.SENTIMENT, "News Count 30D", Direction.HIGHER_BETTER, 20.0, 0.0),
    FeatureSpec("S03", FeatureGroup.SENTIMENT, "Insider Net", Direction.HIGHER_BETTER, 1.0, -1.0, "+1 buy, -1 sell"),
)

assert len({f.id for f in FEATURES}) == 38, "Expected 38 unique feature IDs"

FEATURE_BY_ID: dict[str, FeatureSpec] = {f.id: f for f in FEATURES}
FEATURE_IDS: tuple[str, ...] = tuple(f.id for f in FEATURES)


def features_in_group(group: FeatureGroup) -> tuple[FeatureSpec, ...]:
    return tuple(f for f in FEATURES if f.group == group)
