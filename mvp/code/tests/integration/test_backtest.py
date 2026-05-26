"""Backtest endpoints — TAD g02 §8.5-8.6 + SRS f12 UC-12-03 AC-12-17..26.

 Coverage: 4 endpoints (POST start + 3 GET) + period validation + PRD §4.5 correctness
+ job_lock conflict (409) + terminal status correctness on early-return paths.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.db.session import SessionLocal
from app.job_lock import job_lock
from app.repositories import backtest_repo
from app.services import backtest_service


def _yesterday() -> str:
    return (datetime.now(UTC).date() - timedelta(days=1)).isoformat()


def _tomorrow() -> str:
    return (datetime.now(UTC).date() + timedelta(days=1)).isoformat()


def _3mo_ago() -> str:
    return (datetime.now(UTC).date() - timedelta(days=90)).isoformat()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_start_requires_auth(client):
    r = client.post("/api/backtest", json={"period_from": _3mo_ago(), "period_to": _yesterday()})
    assert r.status_code == 401


def test_status_requires_auth(client):
    assert client.get("/api/backtest/1/status").status_code == 401


def test_metrics_requires_auth(client):
    assert client.get("/api/backtest/1").status_code == 401


def test_results_requires_auth(client):
    assert client.get("/api/backtest/1/results").status_code == 401


# ---------------------------------------------------------------------------
# Period validation — ERR-12-02
# ---------------------------------------------------------------------------


def test_period_invalid_from_after_to_returns_err_12_02(client, auth_headers, completed_run):
    r = client.post(
        "/api/backtest",
        json={"period_from": _yesterday(), "period_to": _3mo_ago()},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-12-02"


def test_period_to_in_future_returns_err_12_02(client, auth_headers, completed_run):
    r = client.post(
        "/api/backtest",
        json={"period_from": _3mo_ago(), "period_to": _tomorrow()},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-12-02"


def test_period_from_equals_to_rejected(client, auth_headers, completed_run):
    same = _yesterday()
    r = client.post(
        "/api/backtest",
        json={"period_from": same, "period_to": same},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-12-02"


# ---------------------------------------------------------------------------
# No baseline run — ERR-12-03
# ---------------------------------------------------------------------------


def test_no_baseline_completed_run_returns_err_12_03(client, auth_headers, screening_data):
    """No COMPLETED run yet → cannot pull scored universe."""
    r = client.post(
        "/api/backtest",
        json={"period_from": _3mo_ago(), "period_to": _yesterday()},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-12-03"


# ---------------------------------------------------------------------------
# Lifecycle: 202 → status terminal → metrics + results
# ---------------------------------------------------------------------------


def test_lifecycle_completes_with_metrics_and_results(client, auth_headers, completed_run):
    """POST → 202 PENDING → BG complete → status COMPLETED → metrics + results shape."""
    r = client.post(
        "/api/backtest",
        json={"period_from": _3mo_ago(), "period_to": _yesterday()},
        headers=auth_headers,
    )
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["success"] is True
    bid = body["data"]["backtest_id"]
    assert isinstance(bid, int) and bid >= 1
    assert body["data"]["status"] in ("PENDING", "RUNNING", "COMPLETED")

    # TestClient await BG → terminal
    s = client.get(f"/api/backtest/{bid}/status", headers=auth_headers)
    assert s.status_code == 200
    sdata = s.json()["data"]
    assert sdata["backtest_id"] == bid
    assert sdata["status"] == "COMPLETED"
    assert sdata["started_at"] is not None
    assert sdata["completed_at"] is not None

    # Metrics
    m = client.get(f"/api/backtest/{bid}", headers=auth_headers)
    assert m.status_code == 200
    md = m.json()["data"]
    expected_keys = {
        "backtest_id", "period_from", "period_to", "status",
        "recommendation_accuracy", "price_error_mean",
        "portfolio_roi", "vnindex_roi", "alpha",
        "correct_count", "total_count", "roi_curve",
    }
    assert expected_keys <= set(md.keys())
    assert md["status"] == "COMPLETED"
    # Accuracy in [0, 1]
    assert 0.0 <= md["recommendation_accuracy"] <= 1.0
    # Alpha = portfolio_roi - vnindex_roi (within rounding tolerance)
    assert abs(md["alpha"] - (md["portfolio_roi"] - md["vnindex_roi"])) < 0.5
    # total_count > 0 and matches scored count of baseline run
    assert md["total_count"] > 0
    assert md["correct_count"] <= md["total_count"]
    # roi_curve length 9..26
    assert 9 <= len(md["roi_curve"]) <= 26
    for pt in md["roi_curve"]:
        assert {"week", "portfolio", "vnindex"} == set(pt.keys())

    # Results per-ticker
    rr = client.get(f"/api/backtest/{bid}/results", headers=auth_headers)
    assert rr.status_code == 200
    items = rr.json()["data"]["results"]
    assert len(items) == md["total_count"]
    # Default sort: price_error_pct DESC (TAD g02 §8.6 BacktestDetailTable)
    err_seq = [r["price_error_pct"] for r in items]
    assert err_seq == sorted(err_seq, reverse=True)
    # Each row has all 7 fields
    for row in items:
        assert {
            "ticker", "predicted_recommendation", "predicted_price", "actual_price",
            "price_error_pct", "actual_return_3m", "recommendation_correct",
        } == set(row.keys())
        assert row["predicted_recommendation"] in ("MUA", "GIU", "BAN")


# ---------------------------------------------------------------------------
# 404 not found
# ---------------------------------------------------------------------------


def test_status_404_unknown_id(client, auth_headers):
    assert client.get("/api/backtest/999999/status", headers=auth_headers).status_code == 404


def test_metrics_404_unknown_id(client, auth_headers):
    assert client.get("/api/backtest/999999", headers=auth_headers).status_code == 404


def test_results_404_unknown_id(client, auth_headers):
    assert client.get("/api/backtest/999999/results", headers=auth_headers).status_code == 404


# ---------------------------------------------------------------------------
# PRD §4.5 strict correctness — AC-12-23 backend phase
# ---------------------------------------------------------------------------


def test_strict_correctness_compares_recommendation_to_vnindex(client, auth_headers, completed_run):
    """PRD §4.5: MUA/BAN must compare against VN-Index benchmark."""
    bid = client.post(
        "/api/backtest",
        json={"period_from": _3mo_ago(), "period_to": _yesterday()},
        headers=auth_headers,
    ).json()["data"]["backtest_id"]
    metrics = client.get(f"/api/backtest/{bid}", headers=auth_headers).json()["data"]
    vnindex = metrics["vnindex_roi"]
    items = client.get(f"/api/backtest/{bid}/results", headers=auth_headers).json()["data"]["results"]
    for r in items:
        rec = r["predicted_recommendation"]
        ret = r["actual_return_3m"]
        expected = (
            (ret > 0 and ret > vnindex) if rec == "MUA"
            else -7.0 <= ret <= 12.0 if rec == "GIU"
            else (ret < 0 or (vnindex - ret) > 5.0) if rec == "BAN"
            else False
        )
        assert r["recommendation_correct"] is expected, (
            f"{r['ticker']} rec={rec} ret={ret} vnindex={vnindex}"
        )


# ---------------------------------------------------------------------------
# Job lock — 409 conflict + terminal status correctness
# ---------------------------------------------------------------------------


def test_post_backtest_returns_409_when_job_lock_held(client, auth_headers, completed_run):
    """POST /api/backtest must reject with 409 ERR-JOB-CONFLICT when another heavy
    job already holds the lock — symmetric with POST /api/run conflict path."""
    job_lock.reset()
    assert job_lock.try_acquire("manual_test_lock", "refresh") is True
    try:
        r = client.post(
            "/api/backtest",
            json={"period_from": _3mo_ago(), "period_to": _yesterday()},
            headers=auth_headers,
        )
        assert r.status_code == 409, r.text
        assert r.json()["error"]["code"] == "ERR-JOB-CONFLICT"
    finally:
        job_lock.reset()


def test_run_backtest_releases_lock_failed_when_no_scored_rows(screening_data):
    """Regression: run_backtest() with baseline that has 0 scored results must release
    job_lock as FAILED (not COMPLETED). Bug history: finally hard-coded COMPLETED →
    DB row marked FAILED but lock said COMPLETED → UI poll inconsistency.
    """
    job_lock.reset()

    # Create backtest row directly (skip API to isolate run_backtest logic)
    with SessionLocal() as db:
        bt = backtest_repo.create_run(
            db,
            period_from=date(2025, 1, 1),
            period_to=date(2025, 4, 1),
            started_at=datetime.now(UTC).replace(tzinfo=None),
            status="PENDING",
        )
        db.commit()
        backtest_id = int(bt.id)

    job_key = "backtest_test_empty_scored"
    assert job_lock.try_acquire(job_key, "backtest") is True

    try:
        # Pass a baseline_run_id that has no results → list_by_run returns [].
        backtest_service.run_backtest(
            backtest_id,
            baseline_run_id="run_does_not_exist",
            job_key=job_key,
        )

        entry = job_lock.get(job_key)
        assert entry is not None
        assert entry["status"] == "FAILED", f"Expected FAILED, got {entry['status']}"
        assert entry["error"] is not None
        assert job_lock.active_job is None

        with SessionLocal() as db:
            row = backtest_repo.get(db, backtest_id)
            assert row.status == "FAILED"
    finally:
        with SessionLocal() as db:
            row = backtest_repo.get(db, backtest_id)
            if row is not None:
                db.delete(row)
                db.commit()
        job_lock.reset()


def test_run_backtest_releases_lock_failed_on_exception(monkeypatch, screening_data, completed_run):
    """Regression: exception during compute must release lock as FAILED."""
    job_lock.reset()

    with SessionLocal() as db:
        bt = backtest_repo.create_run(
            db,
            period_from=date(2025, 1, 1),
            period_to=date(2025, 4, 1),
            started_at=datetime.now(UTC).replace(tzinfo=None),
            status="PENDING",
        )
        db.commit()
        backtest_id = int(bt.id)

    job_key = "backtest_test_exception"
    assert job_lock.try_acquire(job_key, "backtest") is True

    def _explode(*_args, **_kwargs):
        raise RuntimeError("synthetic compute failure")

    monkeypatch.setattr(backtest_service, "_generate_results", _explode)

    try:
        backtest_service.run_backtest(
            backtest_id,
            baseline_run_id=completed_run,
            job_key=job_key,
        )

        entry = job_lock.get(job_key)
        assert entry is not None
        assert entry["status"] == "FAILED"
        assert "synthetic compute failure" in (entry["error"] or "")

        with SessionLocal() as db:
            row = backtest_repo.get(db, backtest_id)
            assert row.status == "FAILED"
    finally:
        with SessionLocal() as db:
            row = backtest_repo.get(db, backtest_id)
            if row is not None:
                db.delete(row)
                db.commit()
        job_lock.reset()
