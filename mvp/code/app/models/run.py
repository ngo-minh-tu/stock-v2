"""Tables 5-7: screening_runs + screening_results + excluded_stocks — TAD g03."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.session import Base


class ScreeningRun(Base):
    __tablename__ = "screening_runs"

    run_id: Mapped[str] = mapped_column(String, primary_key=True)
    run_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="PENDING")
    model_version: Mapped[str] = mapped_column(String, nullable=False)
    settings_version: Mapped[int] = mapped_column(Integer, nullable=False)
    total_capital: Mapped[float] = mapped_column(Numeric, default=0)
    thresholds_json: Mapped[str | None] = mapped_column(Text)
    data_from_cache: Mapped[bool] = mapped_column(Boolean, default=False)
    total_input: Mapped[int | None] = mapped_column(Integer)
    after_round_1: Mapped[int | None] = mapped_column(Integer)
    after_round_2: Mapped[int | None] = mapped_column(Integer)
    after_round_3: Mapped[int | None] = mapped_column(Integer)
    after_round_4: Mapped[int | None] = mapped_column(Integer)
    scored_count: Mapped[int | None] = mapped_column(Integer)
    buy_count: Mapped[int | None] = mapped_column(Integer)
    hold_count: Mapped[int | None] = mapped_column(Integer)
    sell_count: Mapped[int | None] = mapped_column(Integer)
    warnings_json: Mapped[str | None] = mapped_column(Text)
    telegram_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    telegram_error: Mapped[str | None] = mapped_column(Text)
    run_error: Mapped[str | None] = mapped_column(Text)
    duration_seconds: Mapped[float | None] = mapped_column(Numeric)
    current_step: Mapped[str | None] = mapped_column(String)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (Index("idx_runs_run_at", "run_at"),)


class ScreeningResult(Base):
    __tablename__ = "screening_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String, ForeignKey("screening_runs.run_id"), nullable=False)
    ticker: Mapped[str] = mapped_column(String, ForeignKey("stocks.ticker"), nullable=False)
    ai_score: Mapped[float | None] = mapped_column(Numeric)
    recommendation: Mapped[str | None] = mapped_column(String)
    confidence_raw: Mapped[float | None] = mapped_column(Numeric)
    confidence_penalty: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[float | None] = mapped_column(Numeric)
    target_price_3m: Mapped[float | None] = mapped_column(Numeric)
    current_price: Mapped[float | None] = mapped_column(Numeric)
    upside_pct: Mapped[float | None] = mapped_column(Numeric)
    entry_signal: Mapped[str | None] = mapped_column(String)
    entry_reason_code: Mapped[str | None] = mapped_column(String)
    support_zone: Mapped[float | None] = mapped_column(Numeric)
    resistance_zone: Mapped[float | None] = mapped_column(Numeric)
    stop_loss_price: Mapped[float | None] = mapped_column(Numeric)
    allocation_amount: Mapped[float | None] = mapped_column(Numeric)
    allocation_weight: Mapped[float | None] = mapped_column(Numeric)
    warning_badges_json: Mapped[str | None] = mapped_column(Text)
    reasons_json: Mapped[str | None] = mapped_column(Text)
    feature_values_json: Mapped[str | None] = mapped_column(Text)
    feature_availability: Mapped[int | None] = mapped_column(Integer)
    radar_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (
        Index("idx_results_run_ticker", "run_id", "ticker", unique=True),
        Index("idx_results_run", "run_id"),
    )


class ExcludedStock(Base):
    __tablename__ = "excluded_stocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String, ForeignKey("screening_runs.run_id"), nullable=False)
    ticker: Mapped[str] = mapped_column(String, nullable=False)
    excluded_round: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    reason_code: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (Index("idx_excluded_run", "run_id"),)
