"""Create a stable local demo database.

This script is intentionally separate from `seed.py`:
- `seed.py` inserts immutable reference data only.
- `demo_seed.py` adds synthetic but product-shaped prices, financials, and one
  completed screening run so the UI can be demonstrated without touching tests
  or external vnstock.

Run from `mvp/code`:
    DB_PATH=./data/demo-screener.db uv run python -m app.db.demo_seed
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import delete, select

from app.config import get_settings
from app.constants.enums import RunStatus
from app.constants.sources import VNSTOCK_FINANCIAL, VNSTOCK_PRICE
from app.crawlers import cache_manager
from app.db.seed import run as run_seed
from app.db.session import Base, SessionLocal, engine
from app.job_lock import job_lock
from app.models.financial import FinancialReport
from app.models.run import ExcludedStock, ScreeningResult, ScreeningRun
from app.models.settings import Settings as SettingsRow
from app.models.stock import Stock, StockPrice
from app.repositories import screening_repo
from app.services import screening_service

logger = logging.getLogger(__name__)

DEMO_RUN_ID = "run_demo_latest"
DEMO_TOTAL_CAPITAL = 500_000_000


def _db_path() -> Path:
    raw = get_settings().db_path
    path = Path(raw)
    if path.is_absolute():
        return path
    return Path.cwd() / path


def _guard_demo_db() -> None:
    settings = get_settings()
    path = _db_path()
    if settings.app_env == "production":
        raise RuntimeError("Refusing to run demo seed with APP_ENV=production")
    if "demo" not in path.name:
        raise RuntimeError(
            f"Refusing to mutate non-demo DB: {path}. "
            "Run with DB_PATH=./data/demo-screener.db."
        )


def _financials_for(ticker: str, ordinal: int) -> list[dict]:
    debt = 7.0e9 + (ordinal % 5) * 0.35e9
    equity = 13.0e9 + (ordinal % 7) * 0.55e9
    rows: list[dict] = []
    quarters = [(2025, 4), (2025, 3), (2025, 2), (2025, 1)]
    for i, (year, q) in enumerate(quarters):
        scale = 1.0 - i * 0.045 + (ordinal % 4) * 0.01
        rows.append(
            {
                "ticker": ticker,
                "period": f"{year}Q{q}",
                "year": year,
                "quarter": q,
                "revenue": 20.0e9 * scale,
                "net_income": 2.2e9 * scale,
                "total_assets": 65.0e9,
                "total_equity": equity,
                "total_debt": debt,
                "current_assets": 19.0e9,
                "current_liabilities": 11.0e9,
                "inventory": 7.5e9,
                "cogs": 11.0e9 * scale,
                "operating_cash_flow": 2.8e9 * scale,
                "eps": 2400.0 * scale,
                "bvps": 19000.0,
                "advances": 1.8e9 * scale,
                "shares_outstanding": 800_000_000,
                "audit_opinion": "UNQUALIFIED",
            }
        )
    return rows


def _prices_for(ticker: str, ordinal: int, *, days: int = 220) -> list[dict]:
    start = date(2025, 8, 1)
    base_close = 25_000.0 + (ordinal % 14) * 1_150.0
    daily_drift = 0.00035 + (ordinal % 5) * 0.00008
    rows: list[dict] = []
    close = base_close
    for i in range(days):
        wave = 1.0 + (((i % 11) - 5) * 0.0009)
        close = close * (1.0 + daily_drift) * wave
        rows.append(
            {
                "ticker": ticker,
                "date": start + timedelta(days=i),
                "open": round(close * 0.996, 2),
                "high": round(close * 1.018, 2),
                "low": round(close * 0.982, 2),
                "close": round(close, 2),
                "volume": 850_000 + (ordinal % 9) * 85_000 + (i % 7) * 5_000,
                "reference": round(close * 0.997, 2),
                "ceiling": round(close * 1.07, 2),
                "floor": round(close * 0.93, 2),
            }
        )
    return rows


def _clear_demo_data() -> None:
    with SessionLocal() as db:
        db.execute(delete(ScreeningResult))
        db.execute(delete(ExcludedStock))
        db.execute(delete(ScreeningRun))
        db.execute(delete(FinancialReport))
        db.execute(delete(StockPrice))
        db.commit()


def _insert_demo_inputs() -> tuple[int, int]:
    with SessionLocal() as db:
        settings = db.get(SettingsRow, 1)
        if settings is not None:
            settings.buy_threshold = 55
            settings.hold_min_threshold = 45
            settings.version = int(settings.version or 1) + 1
        tickers = list(db.scalars(select(Stock.ticker).where(Stock.status == "ACTIVE")))
        financial_rows: list[dict] = []
        price_rows: list[dict] = []
        for ordinal, ticker in enumerate(tickers):
            financial_rows.extend(_financials_for(ticker, ordinal))
            price_rows.extend(_prices_for(ticker, ordinal))
        db.bulk_insert_mappings(FinancialReport, financial_rows)
        db.bulk_insert_mappings(StockPrice, price_rows)
        cache_manager.mark_refreshed(db, VNSTOCK_PRICE.key, status="FRESH")
        cache_manager.mark_refreshed(db, VNSTOCK_FINANCIAL.key, status="FRESH")
        db.commit()
    return len(price_rows), len(financial_rows)


def _create_demo_run() -> None:
    job_lock.reset()
    job_lock.try_acquire(DEMO_RUN_ID, "screening")
    with SessionLocal() as db:
        settings = db.get(SettingsRow, 1)
        screening_repo.create_run(
            db,
            run_id=DEMO_RUN_ID,
            run_at=datetime.now(UTC),
            status=RunStatus.PENDING.value,
            model_version=screening_service.MODEL_VERSION,
            settings_version=int(settings.version if settings else 1),
            total_capital=DEMO_TOTAL_CAPITAL,
            thresholds_json=json.dumps({"buy": 55, "hold_min": 45}),
        )
        db.commit()
    screening_service.run_screening(
        DEMO_RUN_ID,
        total_capital=DEMO_TOTAL_CAPITAL,
        skip_allocation=False,
    )


def run() -> dict[str, int | str]:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    _guard_demo_db()
    Base.metadata.create_all(bind=engine)
    run_seed()
    _clear_demo_data()
    price_count, financial_count = _insert_demo_inputs()
    _create_demo_run()

    with SessionLocal() as db:
        run_row = db.get(ScreeningRun, DEMO_RUN_ID)
        result_count = len(list(db.scalars(select(ScreeningResult.id))))
        excluded_count = len(list(db.scalars(select(ExcludedStock.id))))

    counts: dict[str, int | str] = {
        "db_path": str(_db_path()),
        "prices": price_count,
        "financial_reports": financial_count,
        "run_id": DEMO_RUN_ID,
        "run_status": run_row.status if run_row else "MISSING",
        "screening_results": result_count,
        "excluded_stocks": excluded_count,
    }
    logger.info("demo seed counts: %s", counts)
    return counts


if __name__ == "__main__":
    run()
