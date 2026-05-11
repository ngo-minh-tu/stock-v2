"""Integration test fixtures — auth token + DB state snapshot/restore.

Tests chạy trên dev DB shared. Mọi test mutation phải restore trong fixture
để các test khác chạy song song không bị poison.
"""

from datetime import date, timedelta

import pytest
from app.db.seed import run as run_seed
from app.db.session import SessionLocal
from app.job_lock import job_lock
from app.models import Settings as SettingsRow
from app.models import UserProfile
from app.models.financial import FinancialReport
from app.models.run import ExcludedStock, ScreeningResult, ScreeningRun
from app.models.stock import StockPrice
from sqlalchemy import delete


@pytest.fixture(scope="session", autouse=True)
def _ensure_seeded():
    """Đảm bảo DB đã seed trước khi bất kỳ integration test nào chạy."""
    run_seed()


@pytest.fixture
def auth_token(client) -> str:
    """Login với password mặc định, return JWT."""
    r = client.post("/api/auth/login", json={"password": "ChangeMe123!"})
    assert r.status_code == 200, r.text
    return r.json()["data"]["token"]


@pytest.fixture
def auth_headers(auth_token) -> dict:
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def restore_user_password():
    """Snapshot user.password_hash trước test, restore sau."""
    with SessionLocal() as db:
        user = db.get(UserProfile, 1)
        original_hash = user.password_hash
    yield
    with SessionLocal() as db:
        user = db.get(UserProfile, 1)
        user.password_hash = original_hash
        db.commit()


# ---------------------------------------------------------------------------
# Synthetic screening data — shared cho Phase 5 + Phase 6 tests
# ---------------------------------------------------------------------------

def _financials_for(ticker: str, *, debt: float = 8e9, equity: float = 12e9, audit: str = "UNQUALIFIED") -> list[dict]:
    rows: list[dict] = []
    quarters = [(2025, 4), (2025, 3), (2025, 2), (2025, 1)]
    for i, (year, q) in enumerate(quarters):
        scale = 1.0 - i * 0.05
        rows.append(
            {
                "ticker": ticker,
                "period": f"{year}Q{q}",
                "year": year,
                "quarter": q,
                "revenue": 20e9 * scale,
                "net_income": 2e9 * scale,
                "total_assets": 60e9,
                "total_equity": equity,
                "total_debt": debt,
                "current_assets": 18e9,
                "current_liabilities": 12e9,
                "inventory": 8e9,
                "cogs": 12e9,
                "operating_cash_flow": 2.5e9,
                "eps": 2200.0 * scale,
                "bvps": 18000.0,
                "advances": 2e9 * scale,
                "shares_outstanding": 800_000_000,
                "audit_opinion": audit,
            }
        )
    return rows


def _prices_for(ticker: str, *, days: int = 200, close: float = 35_000.0, volume: int = 1_500_000) -> list[dict]:
    base = date(2026, 5, 1)
    out: list[dict] = []
    p = float(close)
    for i in range(days):
        out.append(
            {
                "ticker": ticker,
                "date": base - timedelta(days=days - 1 - i),
                "open": p,
                "high": p * 1.01,
                "low": p * 0.99,
                "close": p,
                "volume": int(volume),
                "reference": p,
                "ceiling": p * 1.07,
                "floor": p * 0.93,
            }
        )
        p = p * 1.0008
    return out


@pytest.fixture
def screening_data():
    """Insert synthetic financial + price data cho all 81 ACTIVE tickers; cleanup sau test.

    Shared bởi Phase 5 (run_lifecycle) + Phase 6 (read APIs).
    """
    from app.models.stock import Stock
    from sqlalchemy import select

    job_lock.reset()
    with SessionLocal() as db:
        tickers = list(db.scalars(select(Stock.ticker).where(Stock.status == "ACTIVE")))
        for t in tickers:
            db.bulk_insert_mappings(FinancialReport, _financials_for(t))
            db.bulk_insert_mappings(StockPrice, _prices_for(t))
        db.commit()
    yield tickers

    with SessionLocal() as db:
        db.execute(delete(ScreeningResult))
        db.execute(delete(ExcludedStock))
        db.execute(delete(ScreeningRun))
        db.execute(delete(FinancialReport))
        db.execute(delete(StockPrice))
        db.commit()
    job_lock.reset()


@pytest.fixture
def completed_run(client, auth_headers, screening_data):
    """POST /api/run → return run_id của run đã COMPLETED. TestClient await BG → terminal."""
    r = client.post("/api/run", json={"total_capital": 500_000_000}, headers=auth_headers)
    assert r.status_code == 202, r.text
    return r.json()["data"]["run_id"]


@pytest.fixture
def restore_settings():
    """Snapshot toàn bộ settings row trước test, restore sau."""
    fields = (
        "version",
        "buy_threshold",
        "hold_min_threshold",
        "default_capital",
        "source_cafef",
        "source_vnexpress",
        "source_vietstock",
        "source_batdongsan",
        "source_thanhnien",
        "telegram_enabled",
        "telegram_chat_id",
        "telegram_token",
        "telegram_top_n",
        "theme",
        "classic_mode",
        "language",
    )
    with SessionLocal() as db:
        s = db.get(SettingsRow, 1)
        snapshot = {f: getattr(s, f) for f in fields}
    yield
    with SessionLocal() as db:
        s = db.get(SettingsRow, 1)
        for f, v in snapshot.items():
            setattr(s, f, v)
        db.commit()
