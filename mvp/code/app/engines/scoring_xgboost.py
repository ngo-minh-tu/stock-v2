"""XGBoost scoring engine — STUB.

Real implementation post-MVP: load .pkl từ models/ + predict_proba.
PRD §4.1 dual-model architecture; baseline engine pass MVP UI contract.
"""

from app.engines.base import ScoringEngine, ScoringResult


class ScoringXGBoostEngine(ScoringEngine):
    def __init__(self, model_path: str | None = None) -> None:
        self.model_path = model_path
        self._model = None  # lazy load

    def load(self) -> None:
        raise NotImplementedError(
            "XGBoost model chưa wire — MVP dùng ScoringBaselineEngine. "
            "Post-MVP: load .pkl + predict_proba."
        )

    def score(self, features: dict[str, float]) -> ScoringResult:
        raise NotImplementedError(
            "XGBoost scoring chưa wire — chuyển sang ScoringBaselineEngine."
        )
