"""Anchor feature dicts cho 5 mã (VHM, KDH, NLG, DXG, PDR) + helper synthesizer.

Mỗi anchor là dict {feature_id: value} với DECIMAL convention (xem feature_service).
Golden ai_score trong tests/fixtures/golden_outputs.py.

Lý do hard-code thay vì simulate vnstock: PRD §4.3 walk-forward dùng dữ liệu thực,
nhưng MVP không có model thực + không có historical OHLCV trong test SQLite. Anchor
fixtures fix một bộ feature giả nhưng nhất quán → baseline scoring + golden outputs
deterministic, dễ regression test khi swap engine.
"""

from typing import Any


def _full_feature_dict(overrides: dict[str, float] | None = None) -> dict[str, float]:
    """Default neutral features (≈ score 50 cho mỗi nhóm) — override per anchor."""
    base: dict[str, float] = {
        # Fundamental — tất cả ở mức trung bình
        "F01": 16.0,    # P/E (lower-better, between 8 good and 25 bad → score 53)
        "F02": 1.5,     # P/B
        "F03": 0.10,    # ROE 10%
        "F04": 0.04,    # ROA 4%
        "F05": 2500.0,  # EPS
        "F06": 1.5,     # D/E
        "F07": 0.08,    # Net Margin 8%
        "F08": 0.10,    # Rev growth 10%
        "F09": 0.05,    # Profit growth 5%
        "F10": 1500.0,  # OCF tỷ
        "F11": 1.4,     # Current ratio
        "F12": 0.05,    # Advances
        "F13": 0.5,     # OCF/NI
        "F14": 0.40,    # Inv/TA
        "F15": 0.5,     # Inv turnover
        "F16": 0.0,     # Inv vs Rev growth
        # Technical — neutral
        "T01": 50.0,    # MA Trend
        "T02": 0.0,     # EMA momentum
        "T03": 50.0,    # RSI center
        "T04": 0.0,     # MACD hist
        "T05": 0.5,     # Bollinger center
        "T06": 1_000_000.0,  # Volume
        "T07": 0.0,     # Returns
        "T08": 0.0,
        "T09": 0.0,
        # Macro — current real-ish values
        "M01": 0.06,    # Interest 6%
        "M02": 0.10,    # Credit growth 10%
        "M03": 0.04,    # CPI 4%
        "M04": 3_000_000_000.0,  # FDI
        "M05": 1100.0,  # VN-Index
        # Real estate — sector medians
        "R01": 1500.0,  # land bank
        "R02": 4.0,     # projects
        "R03": 25000.0, # NAV/cp
        "R04": 0.10,    # NAV discount
        "R05": 3.0,     # legal risk neutral
        # Sentiment — neutral
        "S01": 0.0,
        "S02": 5.0,
        "S03": 0.0,
    }
    if overrides:
        base.update(overrides)
    return base


# ----- 5 anchor tickers — mỗi mã chốt 1 ai_score range để map sang entry signal -----

ANCHORS: dict[str, dict[str, Any]] = {
    "VHM": {  # ~92 → MUA + entry BUY_STRONG
        "features": _full_feature_dict({
            "F01": 9.0, "F02": 1.1, "F03": 0.22, "F04": 0.10, "F05": 6500.0,
            "F06": 0.6, "F07": 0.22, "F08": 0.32, "F09": 0.35, "F10": 6000.0,
            "F11": 1.9, "F12": 0.25, "F13": 1.2, "F14": 0.22, "F15": 0.85, "F16": -0.12,
            "T01": 100.0, "T02": 0.06, "T03": 55.0, "T04": 1.8, "T05": 0.55,
            "T06": 2_400_000.0, "T07": 0.10, "T08": 0.20, "T09": 0.35,
            "M02": 0.16, "M05": 1380.0,
            "R01": 6000.0, "R02": 9.0, "R03": 55000.0, "R04": 0.45, "R05": 1.0,
            "S01": 0.7, "S02": 25.0, "S03": 0.8,
        }),
        "current_price": 60.0,        # ngàn đồng → 60_000 VNĐ
        "buy_price": None,
    },
    "KDH": {  # ~78 → MUA, có 1 badge HIGH_INVENTORY → confidence -5pp
        "features": _full_feature_dict({
            "F01": 10.0, "F02": 1.2, "F03": 0.20, "F04": 0.09, "F05": 5500.0,
            "F06": 0.9, "F07": 0.18, "F08": 0.28, "F09": 0.30, "F10": 5000.0,
            "F11": 1.9, "F12": 0.18, "F13": 1.0, "F14": 0.65,  # > 60% → HIGH_INVENTORY badge
            "F15": 0.75, "F16": -0.05,
            "T01": 100.0, "T02": 0.05, "T03": 58.0, "T04": 1.5, "T05": 0.55,
            "T06": 2_000_000.0, "T07": 0.10, "T08": 0.18, "T09": 0.28,
            "M02": 0.14, "M05": 1300.0,
            "R01": 5000.0, "R02": 8.0, "R03": 50000.0, "R04": 0.40, "R05": 1.5,
            "S01": 0.5, "S02": 22.0, "S03": 0.5,
        }),
        "current_price": 38.0,
        "buy_price": 35.0,
    },
    "NLG": {  # ~76 → MUA edge → entry WAIT_FOR_BREAKOUT (gần resistance)
        "features": _full_feature_dict({
            "F01": 11.0, "F02": 1.25, "F03": 0.18, "F04": 0.08, "F05": 5000.0,
            "F06": 1.0, "F07": 0.16, "F08": 0.25, "F09": 0.25, "F10": 4500.0,
            "F11": 1.8, "F12": 0.15, "F13": 0.9, "F14": 0.40,
            "F15": 0.7, "F16": -0.02,
            "T01": 100.0, "T02": 0.04, "T03": 58.0, "T04": 1.0, "T05": 0.55,
            "T06": 1_800_000.0, "T07": 0.08, "T08": 0.15, "T09": 0.22,
            "M02": 0.12, "M05": 1250.0,
            "R01": 4500.0, "R02": 7.0, "R03": 45000.0, "R04": 0.35, "R05": 2.0,
            "S01": 0.4, "S02": 18.0, "S03": 0.3,
        }),
        "current_price": 32.0,
        "buy_price": None,
    },
    "DXG": {  # ~55 → GIU → NO_ENTRY
        "features": _full_feature_dict({
            "F01": 16.0, "F02": 1.7, "F03": 0.10, "F04": 0.04, "F05": 2500.0,
            "F06": 1.6, "F07": 0.08, "F08": 0.05, "F09": 0.03, "F10": 1000.0,
            "F11": 1.4, "F14": 0.45,
            "T01": 50.0, "T02": 0.0, "T03": 50.0, "T04": 0.0, "T05": 0.5,
            "T06": 1_000_000.0,
            "T07": 0.0, "T08": 0.02, "T09": 0.05,
            "M02": 0.08, "M05": 1100.0,
            "R01": 2000.0, "R02": 4.0, "R03": 28000.0, "R04": 0.10, "R05": 3.0,
            "S01": 0.0, "S02": 8.0, "S03": 0.0,
        }),
        "current_price": 18.0,
        "buy_price": None,
    },
    "PDR": {  # ~30 → BAN → NO_ENTRY
        "features": _full_feature_dict({
            "F01": 28.0, "F02": 3.5, "F03": -0.05, "F04": -0.02, "F05": 500.0,
            "F06": 3.5,  # ≥3 → HIGH_DEBT badge
            "F07": -0.05, "F08": -0.18, "F09": -0.30, "F10": -800.0,  # OCF âm → NEGATIVE_OCF
            "F11": 0.7, "F14": 0.55,
            "T01": 0.0, "T02": -0.06, "T03": 28.0, "T04": -1.5,
            "T07": -0.20, "T08": -0.30, "T09": -0.40,
            "R05": 4.5,  # ≥4 → LEGAL_RISK
            "S01": -0.6, "S02": 2.0, "S03": -0.4,
        }),
        "current_price": 16.0,
        "buy_price": None,
    },
}


def get_anchor(ticker: str) -> dict[str, Any]:
    if ticker not in ANCHORS:
        raise KeyError(f"Unknown anchor ticker {ticker}. Have: {list(ANCHORS)}")
    return ANCHORS[ticker]
