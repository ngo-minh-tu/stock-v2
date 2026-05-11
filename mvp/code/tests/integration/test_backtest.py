"""Backtest endpoints — TAD g02 §8.5-8.6 + SRS f12 UC-12-03 AC-12-17..26.

Coverage: 4 endpoints (POST start + 3 GET) + period validation + heuristic correctness.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta


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
# Heuristic correctness — AC-12-23
# ---------------------------------------------------------------------------


def test_heuristic_correctness_per_recommendation(client, auth_headers, completed_run):
    """SRS f12 AC-12-23: MUA correct=return>0; GIU correct=-7..+12; BAN correct=return<0."""
    bid = client.post(
        "/api/backtest",
        json={"period_from": _3mo_ago(), "period_to": _yesterday()},
        headers=auth_headers,
    ).json()["data"]["backtest_id"]
    items = client.get(f"/api/backtest/{bid}/results", headers=auth_headers).json()["data"]["results"]
    for r in items:
        rec = r["predicted_recommendation"]
        ret = r["actual_return_3m"]
        expected = (
            ret > 0 if rec == "MUA"
            else -7.0 <= ret <= 12.0 if rec == "GIU"
            else ret < 0 if rec == "BAN"
            else False
        )
        assert r["recommendation_correct"] is expected, f"{r['ticker']} rec={rec} ret={ret}"
