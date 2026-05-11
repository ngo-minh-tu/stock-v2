"""GET /api/runs/{id}/results + /excluded + /stocks/{ticker} — Phase 6.

Wire 3 endpoints scoped to a run. Dùng fixture `completed_run` (conftest) để có
1 run đã COMPLETED với 81 results.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def test_results_requires_auth(client):
    assert client.get("/api/runs/run_xxx/results").status_code == 401


def test_excluded_requires_auth(client):
    assert client.get("/api/runs/run_xxx/excluded").status_code == 401


def test_stock_detail_requires_auth(client):
    assert client.get("/api/runs/run_xxx/stocks/VHM").status_code == 401


# ---------------------------------------------------------------------------
# 404
# ---------------------------------------------------------------------------

def test_results_404_for_unknown_run(client, auth_headers):
    r = client.get("/api/runs/unknown/results", headers=auth_headers)
    assert r.status_code == 404


def test_excluded_404_for_unknown_run(client, auth_headers):
    r = client.get("/api/runs/unknown/excluded", headers=auth_headers)
    assert r.status_code == 404


def test_stock_detail_404_for_unknown_run(client, auth_headers):
    r = client.get("/api/runs/unknown/stocks/VHM", headers=auth_headers)
    assert r.status_code == 404


def test_stock_detail_404_for_ticker_not_in_run(client, auth_headers, completed_run):
    r = client.get(f"/api/runs/{completed_run}/stocks/UNKNOWN_TICKER", headers=auth_headers)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# /runs/{id}/results
# ---------------------------------------------------------------------------

def test_results_returns_full_array(client, auth_headers, completed_run):
    r = client.get(f"/api/runs/{completed_run}/results", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert "results" in data and "total" in data
    assert data["total"] == len(data["results"])
    assert data["total"] > 0
    # Sample row có shape khớp ResultRow
    row = data["results"][0]
    expected = {
        "ticker", "name", "sector", "exchange", "current_price", "ai_score",
        "recommendation", "confidence", "target_price_3m", "upside_pct",
        "entry_signal", "stop_loss_price", "warning_badges", "radar",
    }
    assert expected <= row.keys()
    assert row["recommendation"] in {"MUA", "GIU", "BAN"}
    # Unit conversion: current_price ngàn đồng (raw 35_000+ → 35.x)
    assert row["current_price"] < 1000  # nếu raw VND > 1000 thì conversion failed


# ---------------------------------------------------------------------------
# /runs/{id}/excluded
# ---------------------------------------------------------------------------

def test_excluded_list(client, auth_headers, completed_run):
    r = client.get(f"/api/runs/{completed_run}/excluded", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert "items" in data and "total" in data
    # Synthetic data clean → 0 excluded; nếu seed mặc định có gì excluded thì items có thể >0
    for item in data["items"]:
        assert item["excluded_round"] in {1, 2, 3, 4}
        assert "reason_code" in item


# ---------------------------------------------------------------------------
# /runs/{id}/stocks/{ticker} — TAD g02 §4 shape
# ---------------------------------------------------------------------------

def test_stock_detail_full_shape(client, auth_headers, completed_run):
    # Lấy 1 ticker hợp lệ từ /results
    rl = client.get(f"/api/runs/{completed_run}/results", headers=auth_headers)
    ticker = rl.json()["data"]["results"][0]["ticker"]

    r = client.get(f"/api/runs/{completed_run}/stocks/{ticker}", headers=auth_headers)
    assert r.status_code == 200
    detail = r.json()["data"]
    # 5 sections per TAD g02 §4
    for key in ("ticker", "name", "run_id", "static", "scoring", "entry", "risk", "reasons", "features", "feature_availability", "radar"):
        assert key in detail, f"Missing {key}"
    assert detail["ticker"] == ticker
    assert detail["run_id"] == completed_run

    static = detail["static"]
    assert {"exchange", "sector", "name", "current_price"} <= static.keys()

    scoring = detail["scoring"]
    assert 0 <= scoring["ai_score"] <= 100
    assert scoring["recommendation"] in {"MUA", "GIU", "BAN"}

    entry = detail["entry"]
    assert "signal" in entry and "reason_code" in entry

    risk = detail["risk"]
    assert "stop_loss_price" in risk and "warning_badges" in risk
    assert isinstance(risk["warning_badges"], list)

    assert isinstance(detail["features"], dict)
    assert isinstance(detail["radar"], dict)
    assert detail["feature_availability"] > 0


def test_stock_detail_ticker_lowercase_normalized(client, auth_headers, completed_run):
    r = client.get(f"/api/runs/{completed_run}/results", headers=auth_headers)
    ticker_upper = r.json()["data"]["results"][0]["ticker"]
    # Test passes bằng lowercase, server upper() normalize
    rl = client.get(f"/api/runs/{completed_run}/stocks/{ticker_upper.lower()}", headers=auth_headers)
    assert rl.status_code == 200
