"""Risk service — stop loss + capital allocation + warning badges + confidence penalty."""

import pytest
from app.constants import reason_codes as rc
from app.services.risk_service import (
    AllocationItem,
    allocate_capital,
    compute_risk,
    confidence_penalty_for_badges,
    derive_warning_badges,
    stop_loss,
)

# -- Stop loss -----------------------------------------------------------------

def test_stop_loss_buy_price():
    """SRS f09 AC-09-01: buy_price × 0.90."""
    assert stop_loss(50.0) == 45.0


def test_stop_loss_current_price():
    """SRS f09 AC-09-02: current_price × 0.90 khi chưa mua."""
    assert stop_loss(100.0) == 90.0


def test_compute_risk_uses_buy_price_when_present():
    out = compute_risk(current_price=50.0, confidence_raw=80.0, features={}, buy_price=40.0)
    assert out.stop_loss_price == 36.0  # 40 * 0.9


def test_compute_risk_uses_current_when_no_buy_price():
    out = compute_risk(current_price=50.0, confidence_raw=80.0, features={}, buy_price=None)
    assert out.stop_loss_price == 45.0


# -- Warning badges ------------------------------------------------------------

def test_high_debt_badge():
    badges = derive_warning_badges({"F06": 3.5})
    assert rc.HIGH_DEBT in badges


def test_negative_ocf_badge():
    badges = derive_warning_badges({"F10": -100.0})
    assert rc.NEGATIVE_OCF in badges


def test_high_inventory_badge():
    badges = derive_warning_badges({"F14": 0.65})
    assert rc.HIGH_INVENTORY in badges


def test_legal_risk_badge():
    badges = derive_warning_badges({"R05": 4.5})
    assert rc.LEGAL_RISK in badges


def test_no_badges_when_clean():
    badges = derive_warning_badges({"F06": 1.0, "F10": 500.0, "F14": 0.30, "R05": 2.0})
    assert badges == []


def test_badges_subset_of_canonical_4():
    """GUARD-01: chỉ 4 badge canonical."""
    badges = derive_warning_badges({"F06": 4.0, "F10": -100.0, "F14": 0.7, "R05": 5.0})
    assert set(badges) <= rc.WARNING_BADGES
    assert len(badges) == 4


# -- Confidence penalty --------------------------------------------------------

@pytest.mark.parametrize(
    "count, expected",
    [(0, 0), (1, 5), (2, 10), (3, 15), (5, 15)],  # cap at 15 (3+ rule, ≤ 20 cap)
)
def test_penalty_per_badge_count(count, expected):
    assert confidence_penalty_for_badges(count) == expected


def test_compute_risk_applies_penalty():
    """1 badge → -5pp; 2 → -10pp."""
    out = compute_risk(current_price=50.0, confidence_raw=80.0, features={"F06": 3.5})
    assert out.confidence_penalty == 5
    assert out.confidence == 75.0


def test_compute_risk_caps_at_zero():
    """Confidence không xuống dưới 0."""
    out = compute_risk(
        current_price=50.0,
        confidence_raw=10.0,
        features={"F06": 4.0, "F10": -100.0, "F14": 0.7},
    )
    assert out.confidence_penalty == 15
    assert out.confidence == 0.0


# -- Capital allocation --------------------------------------------------------

def test_allocation_skipped_when_capital_zero():
    res = allocate_capital([("VHM", 90.0)], total_capital=0)
    assert res.skipped is True
    assert res.items == []


def test_allocation_higher_score_higher_amount():
    """AC-09-05: mã score cao hơn → allocation lớn hơn."""
    res = allocate_capital(
        [("VHM", 90.0), ("KDH", 78.0), ("NLG", 70.0)],
        total_capital=100_000_000,
    )
    amounts = {item.ticker: item.amount for item in res.items}
    assert amounts["VHM"] > amounts["KDH"] > amounts["NLG"]


def test_allocation_sum_equals_capital():
    """AC-09-04: sum(allocations) == total_capital (±1 VNĐ rounding)."""
    res = allocate_capital(
        [("VHM", 90.0), ("KDH", 78.0), ("NLG", 70.0), ("DXG", 65.0)],
        total_capital=500_000_000,
    )
    total = sum(item.amount for item in res.items)
    assert total == 500_000_000


def test_allocation_no_buy_stocks():
    """AC-09-07: 0 mã MUA → empty items."""
    res = allocate_capital([], total_capital=500_000_000)
    assert res.items == []
    assert res.skipped is False


def test_allocation_weights_sum_one():
    res = allocate_capital(
        [("VHM", 90.0), ("KDH", 78.0)],
        total_capital=100_000_000,
    )
    total_weight = sum(item.weight for item in res.items)
    assert abs(total_weight - 1.0) < 0.001


def test_allocation_item_dataclass_immutable_layout():
    """Sanity check dataclass shape."""
    item = AllocationItem(ticker="VHM", weight=0.5, amount=50_000_000)
    assert item.ticker == "VHM"
    assert item.weight == 0.5
    assert item.amount == 50_000_000
