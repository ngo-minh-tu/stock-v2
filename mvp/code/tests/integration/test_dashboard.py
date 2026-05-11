"""GET /api/runs/{id}/dashboard — Phase 6 SRS f04 + cluster 2 5-chart layout."""

from __future__ import annotations


def test_dashboard_requires_auth(client):
    assert client.get("/api/runs/run_xxx/dashboard").status_code == 401


def test_dashboard_404_unknown_run(client, auth_headers):
    r = client.get("/api/runs/unknown/dashboard", headers=auth_headers)
    assert r.status_code == 404


def test_dashboard_full_shape(client, auth_headers, completed_run):
    r = client.get(f"/api/runs/{completed_run}/dashboard", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]

    # 5 sections per SRS f04 + KPIs
    for key in ("run_id", "run_at", "kpis", "treemap", "pie", "radar_avg", "index_trend", "top_by_score"):
        assert key in data, f"Missing {key}"

    kpis = data["kpis"]
    for k in ("scored_count", "buy_count", "hold_count", "sell_count", "alpha_pct"):
        assert k in kpis
    # AC-01-10 mirror: buy + hold + sell == scored
    assert kpis["buy_count"] + kpis["hold_count"] + kpis["sell_count"] == kpis["scored_count"]

    pie = data["pie"]
    assert pie["MUA"] == kpis["buy_count"]
    assert pie["GIU"] == kpis["hold_count"]
    assert pie["BAN"] == kpis["sell_count"]

    # Treemap = scored count
    assert len(data["treemap"]) == kpis["scored_count"]

    # Radar 5 axes
    assert set(data["radar_avg"].keys()) == {"fundamental", "technical", "macro", "realestate", "sentiment"}
    for v in data["radar_avg"].values():
        assert 0 <= v <= 100

    # Index trend 26 weeks
    assert len(data["index_trend"]) == 26
    for pt in data["index_trend"]:
        assert "week" in pt and "vnindex" in pt and "realestate_index" in pt

    # Top 10 max
    assert len(data["top_by_score"]) <= 10
    if data["top_by_score"]:
        scores = [t["ai_score"] for t in data["top_by_score"]]
        assert scores == sorted(scores, reverse=True)
