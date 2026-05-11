"""AI engines — TAD c01.

Pluggable interfaces:
- ScoringEngine (ABC) → scoring_baseline (MVP) | scoring_xgboost (stub)
- PriceEngine    (ABC) → price_baseline   (MVP) | price_lstm      (stub)
- EntryPointEngine     → entry_engine     (deterministic, SRS f03)

Risk service ở app/services/risk_service.py — không phải engine.
"""
