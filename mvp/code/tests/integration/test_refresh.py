"""POST /api/refresh/{all,prices} + GET /api/refresh/{id}/status — TAD g01 §1 + g05 §1."""

import pytest
from app.job_lock import job_lock
from app.services import refresh_service


class _NoopClient:
    """Mock vnstock client — no network. Empty results, no errors."""

    def fetch_prices(self, ticker, *, days=365):
        return []

    def fetch_financials(self, ticker):
        return []


@pytest.fixture(autouse=True)
def _reset_job_lock_and_mock_client(monkeypatch):
    """Fresh JobLock state + mock crawler for every refresh test."""
    job_lock.reset()
    monkeypatch.setattr(refresh_service, "_client_factory", lambda: _NoopClient())
    yield
    job_lock.reset()


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
