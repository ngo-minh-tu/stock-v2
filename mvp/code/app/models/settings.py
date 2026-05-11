"""Table 12: settings — TAD g03 + SRS f15.

Single-row table (id=1). UPDATE in place; bump `version` mỗi lần PUT.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.session import Base


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    buy_threshold: Mapped[int] = mapped_column(Integer, default=75)
    hold_min_threshold: Mapped[int] = mapped_column(Integer, default=45)
    default_capital: Mapped[float] = mapped_column(Numeric, default=0)

    source_cafef: Mapped[bool] = mapped_column(Boolean, default=True)
    source_vnexpress: Mapped[bool] = mapped_column(Boolean, default=True)
    source_vietstock: Mapped[bool] = mapped_column(Boolean, default=True)
    source_batdongsan: Mapped[bool] = mapped_column(Boolean, default=True)
    source_thanhnien: Mapped[bool] = mapped_column(Boolean, default=True)

    telegram_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    telegram_chat_id: Mapped[str] = mapped_column(String, default="")
    telegram_token: Mapped[str] = mapped_column(String, default="")
    telegram_top_n: Mapped[int] = mapped_column(Integer, default=3)

    theme: Mapped[str] = mapped_column(String, default="CLASSIC")
    classic_mode: Mapped[str] = mapped_column(String, default="DARK")
    language: Mapped[str] = mapped_column(String, default="VIE")

    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp())
