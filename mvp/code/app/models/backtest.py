"""Tables 13-14: backtest_runs + backtest_results — TAD g03."""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.session import Base


class BacktestRun(Base):
    __tablename__ = "backtest_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String, default="RUNNING")
    period_from: Mapped[date | None] = mapped_column(Date)
    period_to: Mapped[date | None] = mapped_column(Date)
    recommendation_accuracy: Mapped[float | None] = mapped_column(Numeric)
    price_error_mean: Mapped[float | None] = mapped_column(Numeric)
    portfolio_roi: Mapped[float | None] = mapped_column(Numeric)
    vnindex_roi: Mapped[float | None] = mapped_column(Numeric)
    alpha: Mapped[float | None] = mapped_column(Numeric)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())


class BacktestResult(Base):
    __tablename__ = "backtest_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    backtest_id: Mapped[int] = mapped_column(Integer, ForeignKey("backtest_runs.id"), nullable=False)
    ticker: Mapped[str] = mapped_column(String, nullable=False)
    predicted_recommendation: Mapped[str | None] = mapped_column(String)
    actual_return_3m: Mapped[float | None] = mapped_column(Numeric)
    predicted_price: Mapped[float | None] = mapped_column(Numeric)
    actual_price: Mapped[float | None] = mapped_column(Numeric)
    price_error_pct: Mapped[float | None] = mapped_column(Numeric)
    recommendation_correct: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (Index("idx_bt_results_backtest", "backtest_id"),)
