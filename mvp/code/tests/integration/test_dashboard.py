"""GET /api/runs/{id}/dashboard — Phase 6 SRS f04 + cluster 2 5-chart layout."""

from __future__ import annotations


def test_dashboard_requires_auth(client):
    assert client.get("/api/runs/run_xxx/dashboard").status_code == 401


def test_dashboard_404_unknown_run(client, auth_headers):
    r = client.get("/api/runs/unknown/dashboard", headers=auth_headers)
    assert r.status_code == 404


def test_dashboard_full_shape(client, auth_headers, completed_run):
    """Phase 19 — shape aligned with FE `DashboardResponse` after schema reconcile.

    Top-level keys renamed: `kpis→kpi`, `radar_avg→radar`, `index_trend→line.points`,
    `top_by_score→bar`. KPI gains `avg_buy_score`, `top_upside`,
    `alpha_vs_vnindex_pct` (was `alpha_pct`). Pie becomes a list of
    `{recommendation, count}` slices.
    """
    r = client.get(f"/api/runs/{completed_run}/dashboard", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]

    for key in ("run_id", "run_at", "kpi", "treemap", "pie", "radar", "line", "bar"):
        assert key in data, f"Missing {key}"

    kpi = data["kpi"]
    for k in (
        "scored_count",
        "buy_count",
        "hold_count",
        "sell_count",
        "avg_buy_score",
        "top_upside",
        "alpha_vs_vnindex_pct",
    ):
        assert k in kpi, f"Missing kpi.{k}"
    assert kpi["buy_count"] + kpi["hold_count"] + kpi["sell_count"] == kpi["scored_count"]
    if kpi["top_upside"] is not None:
        assert {"ticker", "upside_pct"} <= set(kpi["top_upside"].keys())

    pie = data["pie"]
    assert isinstance(pie, list) and len(pie) == 3
    by_rec = {slice["recommendation"]: slice["count"] for slice in pie}
    assert by_rec["MUA"] == kpi["buy_count"]
    assert by_rec["GIU"] == kpi["hold_count"]
    assert by_rec["BAN"] == kpi["sell_count"]

    assert len(data["treemap"]) == kpi["scored_count"]

    assert set(data["radar"].keys()) == {"fundamental", "technical", "macro", "realestate", "sentiment"}
    for v in data["radar"].values():
        assert 0 <= v <= 100

    line_points = data["line"]["points"]
    assert len(line_points) == 26
    for pt in line_points:
        assert {"date", "vnindex", "sector"} <= set(pt.keys())

    assert len(data["bar"]) <= 10
    if data["bar"]:
        scores = [t["ai_score"] for t in data["bar"]]
        assert scores == sorted(scores, reverse=True)
