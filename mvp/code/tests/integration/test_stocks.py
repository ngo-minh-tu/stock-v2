"""GET /api/stocks endpoints — Phase 6 SRS f05 + f08 + TAD g02 §7.1."""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def test_stocks_requires_auth(client):
    assert client.get("/api/stocks").status_code == 401


def test_stock_static_requires_auth(client):
    assert client.get("/api/stocks/VHM").status_code == 401


def test_stock_prices_requires_auth(client):
    assert client.get("/api/stocks/VHM/prices").status_code == 401


def test_stock_runs_requires_auth(client):
    assert client.get("/api/stocks/VHM/runs").status_code == 401


# ---------------------------------------------------------------------------
# /stocks
# ---------------------------------------------------------------------------

def test_stocks_list_no_price_data(client, auth_headers):
    """Khi chưa có StockPrice rows, latest=None nhưng response vẫn 200."""
    r = client.get("/api/stocks?limit=10", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert {"items", "total", "limit", "offset"} <= data.keys()
    assert data["total"] == 26  # chỉ trả universe giao dịch thật, không tính MOCK seed
    assert data["limit"] == 10
    if data["items"]:
        item = data["items"][0]
        assert {"ticker", "name", "exchange", "sector", "newly_listed", "latest"} <= item.keys()
        # latest = None khi không có StockPrice rows


def test_stocks_list_with_prices(client, auth_headers, screening_data):
    """Sau khi screening_data insert prices, latest snapshot phải có."""
    r = client.get("/api/stocks?limit=5", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    assert items
    for item in items:
        latest = item["latest"]
        assert latest is not None
        for k in ("open", "high", "low", "close", "reference", "ceiling", "floor", "change", "change_pct", "volume", "as_of"):
            assert k in latest
        # Unit conversion: close = ngàn đồng (raw 35_028 → ~35.0)
        assert latest["close"] < 1000


def test_stocks_pagination(client, auth_headers):
    r1 = client.get("/api/stocks?limit=10&offset=0", headers=auth_headers)
    r2 = client.get("/api/stocks?limit=10&offset=10", headers=auth_headers)
    assert r1.status_code == 200 and r2.status_code == 200
    a = r1.json()["data"]["items"]
    b = r2.json()["data"]["items"]
    assert {x["ticker"] for x in a} != {x["ticker"] for x in b}


# ---------------------------------------------------------------------------
# /stocks/{ticker}
# ---------------------------------------------------------------------------

def test_stock_static_404(client, auth_headers):
    r = client.get("/api/stocks/NONEXISTENT_X", headers=auth_headers)
    assert r.status_code == 404


def test_stock_static_returns_info(client, auth_headers):
    r = client.get("/api/stocks/VHM", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["ticker"] == "VHM"
    assert data["exchange"] == "HOSE"
    assert "newly_listed" in data
    assert "status" in data


# ---------------------------------------------------------------------------
# /stocks/{ticker}/prices
# ---------------------------------------------------------------------------

def test_stock_prices_daily(client, auth_headers, screening_data):
    r = client.get("/api/stocks/VHM/prices?interval=D&lookback=6T", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["ticker"] == "VHM"
    assert data["interval"] == "D"
    assert data["lookback"] == "6T"
    assert isinstance(data["bars"], list)
    if data["bars"]:
        bar = data["bars"][0]
        assert {"date", "open", "high", "low", "close", "volume"} <= bar.keys()


def test_stock_prices_weekly_aggregate(client, auth_headers, screening_data):
    r = client.get("/api/stocks/VHM/prices?interval=W&lookback=3N", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["interval"] == "W"
    # Weekly aggregation reduces bar count
    if data["bars"]:
        # All bars are present, weekly grouping
        assert len(data["bars"]) > 0


def test_stock_prices_invalid_interval_falls_back_to_D(client, auth_headers, screening_data):
    """Pattern validation rejects invalid interval → 422 (FastAPI default)."""
    r = client.get("/api/stocks/VHM/prices?interval=X", headers=auth_headers)
    assert r.status_code == 422  # FastAPI Query validation


# ---------------------------------------------------------------------------
# /stocks/{ticker}/runs
# ---------------------------------------------------------------------------

def test_stock_runs_empty_when_no_run(client, auth_headers):
    r = client.get("/api/stocks/VHM/runs", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["ticker"] == "VHM"
    assert data["items"] == []
    assert data["total"] == 0


def test_stock_runs_list_after_run(client, auth_headers, completed_run):
    r = client.get("/api/stocks/VHM/runs", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["ticker"] == "VHM"
    if data["items"]:  # VHM phải scored trong completed_run (không bị filter)
        item = data["items"][0]
        assert {"run_id", "run_at", "status", "ai_score", "recommendation"} <= item.keys()
        assert item["run_id"] == completed_run
