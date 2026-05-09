---
id: c01
title: Engine Interfaces — Scoring, Price, Entry (abstract contracts)
parent: 00-tad-system-overview.md
type: component
source: docs/TAD_v1.1_Hardened_Locked_Final.md (§10)
---

# c01 — Engine Interfaces

> Parent: [00-tad-system-overview.md](00-tad-system-overview.md)
>
> Implements: [../srs/f01-core-screening-pipeline.md](../srs/f01-core-screening-pipeline.md), [../srs/f09-risk-management.md](../srs/f09-risk-management.md)
>
> Related — global: [g01-runtime.md](g01-runtime.md) (orchestrator calls engines per state), [g03-database.md](g03-database.md) (results persisted to `screening_results`)

---

## 1. Abstract Interfaces

```python
from abc import ABC, abstractmethod

class ScoringEngine(ABC):
    @abstractmethod
    def score(self, features: Dict[str, float]) -> ScoringResult:
        """Input: 38 scoring features dict. Output: ScoringResult."""
        pass

class PriceEngine(ABC):
    @abstractmethod
    def predict(self, ticker: str, prices: List[float], features: Dict[str, float]) -> PriceResult:
        """Output: target_price_3m, target_date, upside_pct."""
        pass

class EntryPointEngine:
    """Deterministic. NOT abstract. Logic cố định theo SRS-03."""
    def evaluate(self, inp: EntryInput) -> EntryResult:
        pass

@dataclass
class ScoringResult:
    ai_score: float           # 0-100
    recommendation: str       # MUA, GIỮ, BÁN
    confidence_raw: float     # predict_proba %
    reasons: List[Reason]

@dataclass
class PriceResult:
    target_price_3m: float
    target_date: str
    upside_pct: float

@dataclass
class EntryResult:
    signal: str               # EntrySignalEnum
    support_zone: float
    resistance_zone: float
    reason_code: str
    raw_indicators_used: List[str]
```

---

## 2. MVP Implementation Rule

Interface bắt buộc tương thích XGBoost/LSTM. Baseline engine được phép. UI/API output không thay đổi.

Concrete engines (xem [Project Structure](00-tad-system-overview.md#3-project-structure) `app/engines/`):
- `scoring_baseline.py` (MVP, weighted normalize)
- `scoring_xgboost.py` (target)
- `price_baseline.py` (MVP)
- `price_lstm.py` (target)
- `entry_engine.py` (deterministic, see [c03-entry-engine.md](c03-entry-engine.md))
