"""Risk management — stop loss + capital allocation + warning badges + confidence penalty.

SRS f09 + g03 §K constants.

- stop_loss_price = reference_price × (1 + STOP_LOSS_DEFAULT_PCT) = ref × 0.90
- allocation chỉ áp dụng cho rec=MUA, weight = ai_score / sum(ai_score) buy stocks
- warning_badges 4 canonical (HIGH_DEBT/NEGATIVE_OCF/HIGH_INVENTORY/LEGAL_RISK) trigger
  từ raw feature values
- confidence_penalty: 1 badge=5, 2=10, ≥3=15, cap=20pp
- confidence = clamp(confidence_raw - confidence_penalty, 0, 100)
"""

from dataclasses import dataclass, field

from app.constants import reason_codes as rc
from app.constants.thresholds import (
    CONFIDENCE_PENALTY_1_BADGE,
    CONFIDENCE_PENALTY_2_BADGES,
    CONFIDENCE_PENALTY_3PLUS,
    CONFIDENCE_PENALTY_CAP,
    STOP_LOSS_DEFAULT_PCT,
)

# SRS g03 §K STOP_LOSS_PCT = 0.10 → multiplier 0.90
STOP_LOSS_MULTIPLIER = 1.0 + STOP_LOSS_DEFAULT_PCT


@dataclass(slots=True)
class RiskOutput:
    stop_loss_price: float
    warning_badges: list[str]
    confidence_penalty: int
    confidence: float


@dataclass(slots=True)
class AllocationItem:
    ticker: str
    weight: float
    amount: float


@dataclass(slots=True)
class AllocationResult:
    items: list[AllocationItem] = field(default_factory=list)
    total_capital: float = 0.0
    skipped: bool = False  # True khi total_capital ≤ 0


# ---------------------------------------------------------------------------
# Warning badge derivation — bám raw feature values (decimal convention).
# ---------------------------------------------------------------------------

def derive_warning_badges(features: dict[str, float]) -> list[str]:
    """4 canonical badges per SRS f07. Frontend warning-badges.ts trigger thresholds."""
    badges: list[str] = []
    de = features.get("F06")
    if de is not None and de >= 3.0:
        badges.append(rc.HIGH_DEBT)
    ocf = features.get("F10")
    if ocf is not None and ocf < 0:
        badges.append(rc.NEGATIVE_OCF)
    inv_ta = features.get("F14")
    if inv_ta is not None and inv_ta > 0.60:
        badges.append(rc.HIGH_INVENTORY)
    legal = features.get("R05")
    if legal is not None and legal >= 4.0:
        badges.append(rc.LEGAL_RISK)
    return badges


def confidence_penalty_for_badges(badge_count: int) -> int:
    if badge_count <= 0:
        return 0
    if badge_count == 1:
        raw = CONFIDENCE_PENALTY_1_BADGE
    elif badge_count == 2:
        raw = CONFIDENCE_PENALTY_2_BADGES
    else:
        raw = CONFIDENCE_PENALTY_3PLUS
    return min(raw, CONFIDENCE_PENALTY_CAP)


def stop_loss(reference_price: float) -> float:
    """SRS f09 UC-09-01. Caller chọn buy_price (nếu có) hoặc current_price."""
    return round(reference_price * STOP_LOSS_MULTIPLIER, 2)


def compute_risk(
    *,
    current_price: float,
    confidence_raw: float,
    features: dict[str, float],
    buy_price: float | None = None,
) -> RiskOutput:
    """Bundle stop_loss + warnings + confidence cho 1 mã."""
    ref = buy_price if buy_price is not None and buy_price > 0 else current_price
    badges = derive_warning_badges(features)
    penalty = confidence_penalty_for_badges(len(badges))
    confidence = max(0.0, min(100.0, confidence_raw - penalty))
    return RiskOutput(
        stop_loss_price=stop_loss(ref),
        warning_badges=badges,
        confidence_penalty=penalty,
        confidence=round(confidence, 2),
    )


# ---------------------------------------------------------------------------
# Capital allocation — SRS f09 UC-09-02
# ---------------------------------------------------------------------------

def allocate_capital(
    buy_stocks: list[tuple[str, float]],
    total_capital: float,
) -> AllocationResult:
    """Tham chiếu SRS-f09 §UC-09-02: weight = ai_score / sum(ai_score MUA).

    Args:
        buy_stocks: [(ticker, ai_score)] — chỉ mã rec=MUA. Caller filter trước.
        total_capital: VNĐ raw đồng. ≤ 0 → skipped.

    Returns: AllocationResult với items[].weight + amount; rounding ±1 VNĐ on largest.
    """
    if total_capital <= 0:
        return AllocationResult(skipped=True, total_capital=total_capital)
    if not buy_stocks:
        return AllocationResult(items=[], total_capital=total_capital)

    total_score = sum(score for _, score in buy_stocks)
    if total_score <= 0:
        return AllocationResult(items=[], total_capital=total_capital)

    items: list[AllocationItem] = []
    allocated = 0.0
    for ticker, score in buy_stocks:
        weight = score / total_score
        amount = round(total_capital * weight)
        items.append(AllocationItem(ticker=ticker, weight=round(weight, 4), amount=amount))
        allocated += amount

    # Rounding fix: dồn ±1 VNĐ vào ticker score cao nhất để sum khớp đúng total_capital.
    diff = total_capital - allocated
    if diff != 0 and items:
        target = max(items, key=lambda i: i.weight)
        target.amount = round(target.amount + diff)
    return AllocationResult(items=items, total_capital=total_capital)
