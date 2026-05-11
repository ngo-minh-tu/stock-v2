"""Reason codes + warning badges + filter exclusion codes — SRS g03 §K/§L/§N + TAD c03.

Reason codes là khoá deterministic, KHÔNG free text. FE map sang i18n string.
Lý do dùng whitelist: tránh LLM-generated text (GUARD-02) + đảm bảo backtest reproducible.
"""

# ---------------------------------------------------------------------------
# Entry signal reason codes — SRS g03 §N (15 enum, cluster 3 lock)
# ---------------------------------------------------------------------------

# Bullish
VALUATION_ATTRACTIVE = "VALUATION_ATTRACTIVE"
BULLISH_TREND = "BULLISH_TREND"
NAV_DISCOUNT = "NAV_DISCOUNT"
STRONG_FUNDAMENTAL = "STRONG_FUNDAMENTAL"
MACD_BULLISH_CROSS = "MACD_BULLISH_CROSS"

# Wait / mixed
NEAR_RESISTANCE = "NEAR_RESISTANCE"
NEAR_SUPPORT = "NEAR_SUPPORT"
OVERBOUGHT = "OVERBOUGHT"
OVERSOLD = "OVERSOLD"
WEAK_TREND = "WEAK_TREND"
AWAIT_BREAKOUT = "AWAIT_BREAKOUT"
AWAIT_PULLBACK = "AWAIT_PULLBACK"
AWAIT_CONFIRMATION = "AWAIT_CONFIRMATION"

# Negative
NEGATIVE_RECOMMENDATION = "NEGATIVE_RECOMMENDATION"
INSUFFICIENT_INDICATORS = "INSUFFICIENT_INDICATORS"

ENTRY_REASON_CODES: frozenset[str] = frozenset(
    {
        VALUATION_ATTRACTIVE,
        BULLISH_TREND,
        NAV_DISCOUNT,
        STRONG_FUNDAMENTAL,
        MACD_BULLISH_CROSS,
        NEAR_RESISTANCE,
        NEAR_SUPPORT,
        OVERBOUGHT,
        OVERSOLD,
        WEAK_TREND,
        AWAIT_BREAKOUT,
        AWAIT_PULLBACK,
        AWAIT_CONFIRMATION,
        NEGATIVE_RECOMMENDATION,
        INSUFFICIENT_INDICATORS,
    }
)

# ---------------------------------------------------------------------------
# Warning badges — SRS f07 + g03 §L (4 canonical, cluster lock)
# ---------------------------------------------------------------------------

HIGH_DEBT = "HIGH_DEBT"
NEGATIVE_OCF = "NEGATIVE_OCF"
LEGAL_RISK = "LEGAL_RISK"
HIGH_INVENTORY = "HIGH_INVENTORY"

WARNING_BADGES: frozenset[str] = frozenset(
    {
        HIGH_DEBT,
        NEGATIVE_OCF,
        LEGAL_RISK,
        HIGH_INVENTORY,
    }
)

# ---------------------------------------------------------------------------
# Filter exclusion codes — frontend EXCLUDED_REASONS + SRS f01 4-round map
# ---------------------------------------------------------------------------

# Round 1 — Red Flags
HIGH_DE = "HIGH_DE"  # D/E ≥ 4
LEGAL_BLOCK = "LEGAL_BLOCK"  # Audit qualified / suspended / delisted
NEWLY_LISTED = "NEWLY_LISTED"  # < 4Q financials → warning, excluded if no data

# Round 2 — Price floor
PENNY_PRICE = "PENNY_PRICE"  # close < 15.000đ

# Round 3 — Liquidity
LOW_LIQUIDITY = "LOW_LIQUIDITY"  # avg vol 20D < 300K shares

# Round 4 — Data completeness
INSUFFICIENT_DATA = "INSUFFICIENT_DATA"  # < 4Q financials hoặc < 6M price history

FILTER_EXCLUSION_CODES: frozenset[str] = frozenset(
    {
        HIGH_DE,
        LEGAL_BLOCK,
        NEWLY_LISTED,
        PENNY_PRICE,
        LOW_LIQUIDITY,
        INSUFFICIENT_DATA,
    }
)

FILTER_ROUND_MAP: dict[str, int] = {
    HIGH_DE: 1,
    LEGAL_BLOCK: 1,
    NEWLY_LISTED: 1,
    PENNY_PRICE: 2,
    LOW_LIQUIDITY: 3,
    INSUFFICIENT_DATA: 4,
}
