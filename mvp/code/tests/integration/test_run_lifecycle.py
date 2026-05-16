"""Run lifecycle — POST /api/run → polling → COMPLETED + bulk results.

End-to-end coverage cho Phase 5 screening orchestrator. Test setup seed synthetic
financials + prices cho tất cả 81 mã ACTIVE để filter+score chạy đầy đủ.

TestClient FastAPI await BackgroundTasks TRƯỚC khi return response (Phase 3 đã ghi nhận
trong SUMMARY §6). Nghĩa là sau `client.post('/api/run')`, BG task đã chạy xong → status
đã terminal. Test check terminal state + counts trực tiếp, không retry polling.
"""

from __future__ import annotations

from app.db.session import SessionLocal
from app.job_lock import job_lock
from app.models.run import ExcludedStock, ScreeningResult, ScreeningRun
from sqlalchemy import func, select

# `screening_data` fixture đã chuyển sang integration/conftest.py (shared với Phase 6).


# ---------------------------------------------------------------------------
# 401 — auth required
# ---------------------------------------------------------------------------

def test_post_run_requires_auth(client):
    r = client.post("/api/run", json={"total_capital": 0})
    assert r.status_code == 401


def test_get_run_status_requires_auth(client):
    r = client.get("/api/runs/run_xxx/status")
    assert r.status_code == 401


def test_get_runs_requires_auth(client):
    r = client.get("/api/runs")
    assert r.status_code == 401


def test_delete_run_requires_auth(client):
    r = client.delete("/api/runs/run_xxx")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# 202 — POST /run + lifecycle
# ---------------------------------------------------------------------------

def test_post_run_returns_202_run_id(client, auth_headers, screening_data):
    r = client.post("/api/run", json={"total_capital": 0}, headers=auth_headers)
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["success"] is True
    data = body["data"]
    assert data["run_id"].startswith("run_")
    # TestClient awaits BG → status đã chạy xong, run đã terminal


def test_run_lifecycle_completes_with_results(client, auth_headers, screening_data):
    """End-to-end: POST → BG runs → COMPLETED + scored_count > 0 + buy/hold/sell counted + results bulk inserted."""
    r = client.post("/api/run", json={"total_capital": 500_000_000}, headers=auth_headers)
    assert r.status_code == 202
    run_id = r.json()["data"]["run_id"]

    # Status terminal sau BG hoàn thành
    rs = client.get(f"/api/runs/{run_id}/status", headers=auth_headers)
    assert rs.status_code == 200
    status_body = rs.json()["data"]
    assert status_body["status"] in {"COMPLETED", "COMPLETED_WITH_WARNINGS"}, status_body
    assert status_body["progress_percent"] == 100
    assert status_body["duration_seconds"] is not None

    # Summary có counts đầy đủ
    rsum = client.get(f"/api/runs/{run_id}", headers=auth_headers)
    assert rsum.status_code == 200
    summ = rsum.json()["data"]
    assert summ["total_input"] == 81
    assert summ["scored_count"] > 0
    # AC-01-10: buy + hold + sell == scored_count
    assert summ["buy_count"] + summ["hold_count"] + summ["sell_count"] == summ["scored_count"]
    # AC-01-03: total_input = after_round_1 + excluded_round_1 (excluded count check qua DB)
    with SessionLocal() as db:
        excluded_r1 = db.scalar(
            select(func.count())
            .select_from(ExcludedStock)
            .where(ExcludedStock.run_id == run_id, ExcludedStock.excluded_round == 1)
        )
        assert summ["total_input"] == summ["after_round_1"] + (excluded_r1 or 0)

        # Results bulk inserted = scored_count
        results_count = db.scalar(
            select(func.count())
            .select_from(ScreeningResult)
            .where(ScreeningResult.run_id == run_id)
        )
        assert results_count == summ["scored_count"]


def test_run_results_have_valid_recommendations(client, auth_headers, screening_data):
    """AC-01-09: ai_score 0-100, recommendation in MUA/GIU/BAN."""
    r = client.post("/api/run", json={"total_capital": 0}, headers=auth_headers)
    run_id = r.json()["data"]["run_id"]
    with SessionLocal() as db:
        results = db.scalars(
            select(ScreeningResult).where(ScreeningResult.run_id == run_id)
        ).all()
    assert results, "Expected ≥1 result row"
    for row in results:
        assert 0.0 <= float(row.ai_score) <= 100.0
        assert row.recommendation in {"MUA", "GIU", "BAN"}
        assert row.entry_signal is not None
        assert row.feature_availability is not None and row.feature_availability > 0


def test_allocation_only_for_buy_recommendations(client, auth_headers, screening_data):
    """AC-09-04: sum(allocations) ≈ total_capital. Chỉ MUA mới có allocation_amount."""
    capital = 500_000_000
    r = client.post("/api/run", json={"total_capital": capital}, headers=auth_headers)
    run_id = r.json()["data"]["run_id"]
    with SessionLocal() as db:
        results = db.scalars(
            select(ScreeningResult).where(ScreeningResult.run_id == run_id)
        ).all()
    buys = [r for r in results if r.recommendation == "MUA"]
    if buys:
        total_alloc = sum(float(r.allocation_amount or 0) for r in buys)
        assert abs(total_alloc - capital) <= 1.0  # ±1 VNĐ rounding
    non_buys = [r for r in results if r.recommendation != "MUA"]
    for r in non_buys:
        assert r.allocation_amount is None


def test_skip_allocation_flag(client, auth_headers, screening_data):
    """skip_allocation=True → tất cả allocation_amount = NULL kể cả MUA."""
    r = client.post(
        "/api/run",
        json={"total_capital": 500_000_000, "skip_allocation": True},
        headers=auth_headers,
    )
    run_id = r.json()["data"]["run_id"]
    with SessionLocal() as db:
        results = db.scalars(
            select(ScreeningResult).where(ScreeningResult.run_id == run_id)
        ).all()
    for row in results:
        assert row.allocation_amount is None


# ---------------------------------------------------------------------------
# 409 — concurrent run conflict
# ---------------------------------------------------------------------------

def test_concurrent_run_returns_409(client, auth_headers):
    """Manual acquire screening lock → 2nd POST /run trả 409."""
    job_lock.reset()
    assert job_lock.try_acquire("manual_run_xxx", "screening")
    try:
        r = client.post("/api/run", json={"total_capital": 0}, headers=auth_headers)
        assert r.status_code == 409
        body = r.json()
        assert body["success"] is False
        assert body["error"]["code"] == "ERR-JOB-CONFLICT"
    finally:
        job_lock.reset()


# ---------------------------------------------------------------------------
# 404 — unknown run
# ---------------------------------------------------------------------------

def test_get_run_status_404(client, auth_headers):
    r = client.get("/api/runs/unknown_run_id/status", headers=auth_headers)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ERR-NOT-FOUND"


def test_get_run_summary_404(client, auth_headers):
    r = client.get("/api/runs/unknown_run_id", headers=auth_headers)
    assert r.status_code == 404


def test_delete_run_404(client, auth_headers):
    r = client.delete("/api/runs/unknown_run_id", headers=auth_headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /runs paginated
# ---------------------------------------------------------------------------

def test_get_runs_paginated_after_run(client, auth_headers, screening_data):
    r = client.post("/api/run", json={"total_capital": 0}, headers=auth_headers)
    assert r.status_code == 202

    r2 = client.get("/api/runs?limit=10&offset=0", headers=auth_headers)
    assert r2.status_code == 200
    body = r2.json()["data"]
    assert body["total"] >= 1
    assert body["limit"] == 10
    assert body["offset"] == 0
    item = body["items"][0]
    expected_keys = {
        "run_id", "run_at", "status", "scored_count", "buy_count", "hold_count",
        "sell_count", "model_version", "settings_version", "duration_seconds",
        "warnings_count", "avg_score",
    }
    assert expected_keys <= item.keys()


# ---------------------------------------------------------------------------
# DELETE /runs/{id} cascade
# ---------------------------------------------------------------------------

def test_delete_run_cascade(client, auth_headers, screening_data):
    r = client.post("/api/run", json={"total_capital": 0}, headers=auth_headers)
    run_id = r.json()["data"]["run_id"]

    # Verify rows tồn tại
    with SessionLocal() as db:
        before_results = db.scalar(
            select(func.count())
            .select_from(ScreeningResult)
            .where(ScreeningResult.run_id == run_id)
        )
        assert (before_results or 0) > 0

    rd = client.delete(f"/api/runs/{run_id}", headers=auth_headers)
    assert rd.status_code == 200
    body = rd.json()["data"]
    assert body["run_id"] == run_id
    assert body["deleted"] is True

    # Verify cascade
    with SessionLocal() as db:
        assert db.get(ScreeningRun, run_id) is None
        after_results = db.scalar(
            select(func.count())
            .select_from(ScreeningResult)
            .where(ScreeningResult.run_id == run_id)
        )
        assert (after_results or 0) == 0


# ---------------------------------------------------------------------------
# FE contract — status response always carries `warnings` (≥ [])
# ---------------------------------------------------------------------------


def test_get_run_status_includes_warnings_field(client, auth_headers, screening_data):
    """RunStatusResponse.warnings (extra='forbid') is consumed by FE RunContext +
    RunHistoryTable + ConfidenceCard + RedFlagsBadgesTable. Guard against silent
    field removal that would crash FE on parse.
    """
    r = client.post("/api/run", json={"total_capital": 0}, headers=auth_headers)
    run_id = r.json()["data"]["run_id"]

    rs = client.get(f"/api/runs/{run_id}/status", headers=auth_headers)
    assert rs.status_code == 200
    data = rs.json()["data"]
    assert "warnings" in data, "RunStatusResponse must always include `warnings` field"
    assert isinstance(data["warnings"], list)
    for w in data["warnings"]:
        # Shape per RunWarning schema: {code, message}
        assert {"code", "message"} <= set(w.keys())
