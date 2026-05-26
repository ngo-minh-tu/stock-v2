"""POST /api/refresh/{all,prices} + GET /api/refresh/{id}/status — TAD g01 §1 + g05 §1."""

from datetime import date

import pytest
from app.constants.sources import VNSTOCK_FINANCIAL, VNSTOCK_PRICE
from app.crawlers import cache_manager
from app.crawlers.macro_crawler import MacroPoint
from app.db.session import SessionLocal
from app.job_lock import job_lock
from app.models import CacheMetadata
from app.repositories import financial_repo
from app.services import refresh_service


class _NoopClient:
    """Mock vnstock client — no network. Empty results, no errors."""

    def fetch_prices(self, ticker, *, days=365):
        return []

    def fetch_financials(self, ticker):
        return []


class _SystemExitClient:
    """Simulates vnstock quota path, which can call sys.exit() inside the library."""

    def fetch_prices(self, ticker, *, days=365):
        raise SystemExit("Rate limit exceeded")

    def fetch_financials(self, ticker):
        return []


class _MixedClient:
    """Success for VHM, empty for VIC, failure for NVL."""

    calls: list[str] = []

    def fetch_prices(self, ticker, *, days=365):
        self.calls.append(ticker)
        if ticker == "VHM":
            return [
                {
                    "ticker": ticker,
                    "date": date(2026, 5, 18),
                    "open": 50_000,
                    "high": 51_000,
                    "low": 49_000,
                    "close": 50_500,
                    "volume": 1_000_000,
                }
            ]
        if ticker == "VIC":
            return []
        raise refresh_service.VnstockUnavailable("boom")

    def fetch_financials(self, ticker):
        return []


def _reset_price_cache() -> None:
    with SessionLocal() as db:
        row = db.get(CacheMetadata, VNSTOCK_PRICE.key)
        if row is None:
            row = CacheMetadata(source=VNSTOCK_PRICE.key, ttl_hours=VNSTOCK_PRICE.ttl_hours)
            db.add(row)
        row.last_refreshed_at = None
        row.status = "STALE"
        db.commit()


def _reset_financial_cache() -> None:
    with SessionLocal() as db:
        row = db.get(CacheMetadata, VNSTOCK_FINANCIAL.key)
        if row is None:
            row = CacheMetadata(source=VNSTOCK_FINANCIAL.key, ttl_hours=VNSTOCK_FINANCIAL.ttl_hours)
            db.add(row)
        row.last_refreshed_at = None
        row.status = "STALE"
        db.commit()


def _price_cache_status() -> str | None:
    with SessionLocal() as db:
        row = db.get(CacheMetadata, VNSTOCK_PRICE.key)
        return row.status if row else None


def _financial_cache_status() -> str | None:
    with SessionLocal() as db:
        row = db.get(CacheMetadata, VNSTOCK_FINANCIAL.key)
        return row.status if row else None


@pytest.fixture(autouse=True)
def _reset_job_lock_and_mock_client(monkeypatch):
    """Fresh JobLock state + mock crawler for every refresh test."""
    job_lock.reset()
    refresh_service._last_price_retry_tickers = []
    _reset_price_cache()
    _reset_financial_cache()
    monkeypatch.setattr(refresh_service, "_client_factory", lambda: _NoopClient())
    monkeypatch.setattr(
        refresh_service,
        "_macro_fetcher",
        lambda *, vnstock_client=None: (
            [MacroPoint("M05", "2026-05-18", 1300.0, "test")],
            [],
        ),
    )
    yield
    job_lock.reset()
    refresh_service._last_price_retry_tickers = []
    _reset_price_cache()
    _reset_financial_cache()


def test_post_refresh_prices_requires_auth(client):
    r = client.post("/api/refresh/prices")
    assert r.status_code == 401


def test_post_refresh_all_requires_auth(client):
    r = client.post("/api/refresh/all")
    assert r.status_code == 401


def test_post_refresh_prices_returns_202_with_refresh_id(client, auth_headers):
    r = client.post("/api/refresh/prices", headers=auth_headers)
    assert r.status_code == 202
    body = r.json()
    assert body["success"] is True
    assert body["data"]["refresh_id"].startswith("refresh_")
    assert body["data"]["status"] == "PENDING"


def test_post_refresh_all_returns_202(client, auth_headers):
    r = client.post("/api/refresh/all", headers=auth_headers)
    assert r.status_code == 202
    assert r.json()["data"]["status"] == "PENDING"


def test_get_refresh_status_returns_terminal_after_bg_task(client, auth_headers):
    r = client.post("/api/refresh/prices", headers=auth_headers)
    refresh_id = r.json()["data"]["refresh_id"]

    # TestClient flushes BackgroundTasks before response hand-back → terminal already.
    s = client.get(f"/api/refresh/{refresh_id}/status", headers=auth_headers)
    assert s.status_code == 200
    data = s.json()["data"]
    assert data["refresh_id"] == refresh_id
    assert data["status"] in {"COMPLETED", "FAILED"}
    assert data["finished_at"] is not None
    assert data["progress"] == 100 or data["status"] == "FAILED"
    assert "stats" in data


def test_get_refresh_status_unknown_404(client, auth_headers):
    r = client.get("/api/refresh/refresh_doesnotexist/status", headers=auth_headers)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ERR-NOT-FOUND"


def test_post_refresh_when_locked_returns_409(client, auth_headers):
    """Manual acquire → POST refresh → 409 ERR-JOB-CONFLICT."""
    assert job_lock.try_acquire("manual_screening_x", "screening") is True
    try:
        r = client.post("/api/refresh/prices", headers=auth_headers)
        assert r.status_code == 409
        body = r.json()
        assert body["error"]["code"] == "ERR-JOB-CONFLICT"
        assert "screening" in body["error"]["message"]
    finally:
        job_lock.release("manual_screening_x", status="COMPLETED")


def test_refresh_status_requires_auth(client):
    r = client.get("/api/refresh/refresh_x/status")
    assert r.status_code == 401


def test_refresh_prices_recovers_when_vnstock_calls_system_exit(client, auth_headers, monkeypatch):
    """Production-data guard: vnstock quota must not leave the global job lock stuck."""
    monkeypatch.setattr(refresh_service, "_client_factory", lambda: _SystemExitClient())
    monkeypatch.setattr(refresh_service.stock_repo, "list_active_tickers", lambda db: ["VHM"])

    r = client.post("/api/refresh/prices", headers=auth_headers)
    assert r.status_code == 202
    refresh_id = r.json()["data"]["refresh_id"]

    s = client.get(f"/api/refresh/{refresh_id}/status", headers=auth_headers)
    data = s.json()["data"]
    assert data["status"] == "FAILED"
    assert data["finished_at"] is not None
    assert data["error"] == "All 1 tickers failed"
    assert data["stats"]["failed"] == 1
    assert data["stats"]["failed_tickers"] == ["VHM"]
    assert job_lock.active_job is None


def test_refresh_prices_reports_partial_stats_and_keeps_success_rows(client, auth_headers, monkeypatch):
    mixed = _MixedClient()
    monkeypatch.setattr(refresh_service, "_client_factory", lambda: mixed)
    monkeypatch.setattr(refresh_service.stock_repo, "list_active_tickers", lambda db: ["VHM", "VIC", "NVL"])

    r = client.post("/api/refresh/prices", headers=auth_headers)
    assert r.status_code == 202
    refresh_id = r.json()["data"]["refresh_id"]

    s = client.get(f"/api/refresh/{refresh_id}/status", headers=auth_headers)
    data = s.json()["data"]
    assert data["status"] == "COMPLETED"
    assert data["stats"]["total"] == 3
    assert data["stats"]["success"] == 1
    assert data["stats"]["full_universe"] is True
    assert data["stats"]["empty"] == 1
    assert data["stats"]["failed"] == 1
    assert data["stats"]["rows"] == 1
    assert data["stats"]["empty_tickers"] == ["VIC"]
    assert data["stats"]["failed_tickers"] == ["NVL"]
    assert refresh_service._last_price_retry_tickers == ["NVL", "VIC"]
    assert _price_cache_status() == "PARTIAL"
    with SessionLocal() as db:
        assert cache_manager.is_usable(db, VNSTOCK_PRICE.key) is False


def test_refresh_prices_resume_failed_reuses_last_failed_and_empty_tickers(
    client,
    auth_headers,
    monkeypatch,
):
    refresh_service._last_price_retry_tickers = ["NVL", "VIC"]
    calls: list[str] = []

    class _ResumeClient:
        def fetch_prices(self, ticker, *, days=365):
            calls.append(ticker)
            return [
                {
                    "ticker": ticker,
                    "date": date(2026, 5, 18),
                    "open": 20_000,
                    "high": 21_000,
                    "low": 19_000,
                    "close": 20_500,
                    "volume": 900_000,
                }
            ]

    monkeypatch.setattr(refresh_service, "_client_factory", lambda: _ResumeClient())
    monkeypatch.setattr(refresh_service.stock_repo, "list_active_tickers", lambda db: ["VHM", "VIC", "NVL"])

    r = client.post("/api/refresh/prices", json={"resume_failed": True}, headers=auth_headers)
    assert r.status_code == 202
    refresh_id = r.json()["data"]["refresh_id"]

    s = client.get(f"/api/refresh/{refresh_id}/status", headers=auth_headers)
    data = s.json()["data"]
    assert calls == ["NVL", "VIC"]
    assert data["status"] == "COMPLETED"
    assert data["stats"]["total"] == 2
    assert data["stats"]["full_universe"] is False
    assert data["stats"]["success"] == 2
    assert data["stats"]["failed"] == 0
    assert refresh_service._last_price_retry_tickers == []
    assert _price_cache_status() == "PARTIAL"


def test_refresh_prices_full_universe_success_marks_price_cache_fresh(
    client,
    auth_headers,
    monkeypatch,
):
    class _SuccessClient:
        def fetch_prices(self, ticker, *, days=365):
            return [
                {
                    "ticker": ticker,
                    "date": date(2026, 5, 18),
                    "open": 20_000,
                    "high": 21_000,
                    "low": 19_000,
                    "close": 20_500,
                    "volume": 900_000,
                }
            ]

    monkeypatch.setattr(refresh_service, "_client_factory", lambda: _SuccessClient())
    monkeypatch.setattr(refresh_service.stock_repo, "list_active_tickers", lambda db: ["VHM", "VIC"])

    r = client.post("/api/refresh/prices", headers=auth_headers)
    assert r.status_code == 202
    refresh_id = r.json()["data"]["refresh_id"]

    s = client.get(f"/api/refresh/{refresh_id}/status", headers=auth_headers)
    data = s.json()["data"]
    assert data["status"] == "COMPLETED"
    assert data["stats"]["total"] == 2
    assert data["stats"]["full_universe"] is True
    assert data["stats"]["success"] == 2
    assert data["stats"]["empty"] == 0
    assert data["stats"]["failed"] == 0
    assert _price_cache_status() == "FRESH"
    with SessionLocal() as db:
        assert cache_manager.is_usable(db, VNSTOCK_PRICE.key) is True


def test_refresh_all_marks_price_cache_partial_when_any_price_fails(client, auth_headers, monkeypatch):
    mixed = _MixedClient()
    monkeypatch.setattr(refresh_service, "_client_factory", lambda: mixed)
    monkeypatch.setattr(refresh_service.stock_repo, "list_active_tickers", lambda db: ["VHM", "VIC", "NVL"])

    r = client.post("/api/refresh/all", headers=auth_headers)
    assert r.status_code == 202
    refresh_id = r.json()["data"]["refresh_id"]

    s = client.get(f"/api/refresh/{refresh_id}/status", headers=auth_headers)
    data = s.json()["data"]
    assert data["status"] == "COMPLETED"
    assert data["stats"]["prices"]["full_universe"] is True
    assert data["stats"]["prices"]["success"] == 1
    assert data["stats"]["prices"]["empty"] == 1
    assert data["stats"]["prices"]["failed"] == 1
    assert _price_cache_status() == "PARTIAL"


def test_refresh_all_upserts_financials_and_marks_financial_cache_fresh(
    client,
    auth_headers,
    monkeypatch,
):
    class _SuccessAllClient:
        def fetch_prices(self, ticker, *, days=365):
            return [
                {
                    "ticker": ticker,
                    "date": date(2026, 5, 18),
                    "open": 50_000,
                    "high": 51_000,
                    "low": 49_000,
                    "close": 50_500,
                    "volume": 1_000_000,
                }
            ]

        def fetch_financials(self, ticker):
            return [
                {
                    "ticker": ticker,
                    "period": "2026Q1",
                    "year": 2026,
                    "quarter": 1,
                    "revenue": 100e9,
                    "net_income": 12e9,
                    "total_assets": 500e9,
                    "total_equity": 200e9,
                    "total_debt": 300e9,
                    "current_assets": 150e9,
                    "current_liabilities": 80e9,
                    "inventory": 40e9,
                    "cogs": 70e9,
                    "operating_cash_flow": 20e9,
                    "eps": 1200,
                    "bvps": 20_000,
                    "advances": 30e9,
                    "shares_outstanding": 1_000_000,
                    "audit_opinion": "UNQUALIFIED",
                }
            ]

    monkeypatch.setattr(refresh_service, "_client_factory", lambda: _SuccessAllClient())
    monkeypatch.setattr(refresh_service.stock_repo, "list_active_tickers", lambda db: ["VHM"])

    r = client.post("/api/refresh/all", headers=auth_headers)
    assert r.status_code == 202
    refresh_id = r.json()["data"]["refresh_id"]

    s = client.get(f"/api/refresh/{refresh_id}/status", headers=auth_headers)
    data = s.json()["data"]
    assert data["status"] == "COMPLETED"
    assert data["stats"]["financials"]["success"] == 1
    assert data["stats"]["financials"]["rows"] == 1
    assert _financial_cache_status() == "FRESH"
    with SessionLocal() as db:
        report = financial_repo.latest(db, "VHM")
        assert report is not None
        assert report.period == "2026Q1"
        assert float(report.revenue) == 100e9
        assert cache_manager.is_usable(db, VNSTOCK_FINANCIAL.key) is True
