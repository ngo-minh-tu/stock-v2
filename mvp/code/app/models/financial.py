"""Table 3: financial_reports — TAD g03."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.session import Base


class FinancialReport(Base):
    __tablename__ = "financial_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String, ForeignKey("stocks.ticker"), nullable=False)
    period: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "2025Q4"
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    quarter: Mapped[int] = mapped_column(Integer, nullable=False)
    revenue: Mapped[float | None] = mapped_column(Numeric)
    net_income: Mapped[float | None] = mapped_column(Numeric)
    total_assets: Mapped[float | None] = mapped_column(Numeric)
    total_equity: Mapped[float | None] = mapped_column(Numeric)
    total_debt: Mapped[float | None] = mapped_column(Numeric)
    current_assets: Mapped[float | None] = mapped_column(Numeric)
    current_liabilities: Mapped[float | None] = mapped_column(Numeric)
    inventory: Mapped[float | None] = mapped_column(Numeric)
    cogs: Mapped[float | None] = mapped_column(Numeric)
    operating_cash_flow: Mapped[float | None] = mapped_column(Numeric)
    eps: Mapped[float | None] = mapped_column(Numeric)
    bvps: Mapped[float | None] = mapped_column(Numeric)
    advances: Mapped[float | None] = mapped_column(Numeric)
    shares_outstanding: Mapped[int | None] = mapped_column(Integer)
    audit_opinion: Mapped[str | None] = mapped_column(String)
    cached_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (Index("idx_fin_ticker_period", "ticker", "period", unique=True),)
