"""Engine ABCs + result dataclasses — TAD c01 §1."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class Reason:
    """Single explanation entry (top contributing/dragging feature)."""

    feature_id: str
    score: float  # 0..100
    direction: str  # "boost" | "drag"


@dataclass(frozen=True, slots=True)
class ScoringResult:
    ai_score: float  # 0..100
    recommendation: str  # MUA | GIU | BAN
    confidence_raw: float  # 0..100, predict_proba-style
    reasons: list[Reason] = field(default_factory=list)
    radar: dict[str, float] = field(default_factory=dict)  # group → 0..100


@dataclass(frozen=True, slots=True)
class PriceResult:
    target_price_3m: float
    target_date: str  # ISO yyyy-mm-dd
    upside_pct: float


@dataclass(frozen=True, slots=True)
class EntryInput:
    recommendation: str
    ai_score: float
    confidence: float
    upside_pct: float
    nav_discount_pct: float
    rsi: float
    price: float
    ma20: float
    macd_histogram: float
    macd_signal_cross: bool
    bollinger_upper: float
    bollinger_lower: float
    nearest_support: float
    nearest_resistance: float
    technical_features_available: int
    technical_features_required: int = 8


@dataclass(frozen=True, slots=True)
class EntryResult:
    signal: str
    support_zone: float
    resistance_zone: float
    reason_code: str
    raw_indicators_used: list[str]


class ScoringEngine(ABC):
    @abstractmethod
    def score(self, features: dict[str, float]) -> ScoringResult:
        """38 scoring features → ScoringResult."""


class PriceEngine(ABC):
    @abstractmethod
    def predict(
        self,
        ticker: str,
        prices: list[float],
        features: dict[str, float],
    ) -> PriceResult:
        """Predict target_price_3m + target_date + upside_pct."""
