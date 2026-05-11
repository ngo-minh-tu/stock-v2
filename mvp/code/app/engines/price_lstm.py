"""LSTM price engine — STUB.

Real implementation post-MVP: load .h5 + sequence predict.
PRD §4.1 dual-model architecture; baseline engine pass MVP UI contract.
"""

from app.engines.base import PriceEngine, PriceResult


class PriceLSTMEngine(PriceEngine):
    def __init__(self, model_path: str | None = None) -> None:
        self.model_path = model_path
        self._model = None  # lazy load

    def load(self) -> None:
        raise NotImplementedError(
            "LSTM model chưa wire — MVP dùng PriceBaselineEngine. "
            "Post-MVP: load .h5 + sequence predict."
        )

    def predict(
        self,
        ticker: str,
        prices: list[float],
        features: dict[str, float],
    ) -> PriceResult:
        raise NotImplementedError(
            "LSTM price prediction chưa wire — chuyển sang PriceBaselineEngine."
        )
