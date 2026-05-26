"""GET /api/runs/{a}/compare/{b} — Phase 6 TAD g02 §8.3 4-section shape."""

from __future__ import annotations


def test_compare_requires_auth(client):
    assert client.get("/api/runs/a/compare/b").status_code == 401


def test_compare_same_run_400(client, auth_headers, completed_run):
    r = client.get(f"/api/runs/{completed_run}/compare/{completed_run}", headers=auth_headers)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-12-01"


def test_compare_404_unknown_run(client, auth_headers, completed_run):
    r = client.get(f"/api/runs/{completed_run}/compare/unknown_run", headers=auth_headers)
    assert r.status_code == 404


def test_compare_full_shape(client, auth_headers, screening_data):
    """Tạo 2 runs liên tiếp để compare. Settings không thay đổi → recommendation_changes=[]."""
    # Run A
    r1 = client.post("/api/run", json={"total_capital": 100_000_000}, headers=auth_headers)
    a_id = r1.json()["data"]["run_id"]
    # Run B (sau A)
    r2 = client.post("/api/run", json={"total_capital": 200_000_000}, headers=auth_headers)
    b_id = r2.json()["data"]["run_id"]

    r = client.get(f"/api/runs/{a_id}/compare/{b_id}", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]

    # 4 sections per TAD g02 §8.3
    for key in ("summary_diff", "recommendation_changes", "new_entries", "removed", "score_distribution"):
        assert key in data, f"Missing {key}"

    sd = data["summary_diff"]
    for metric in ("scored", "buy_count", "hold_count", "sell_count", "avg_score", "duration_seconds"):
        assert metric in sd
        assert {"a", "b", "delta"} <= sd[metric].keys()
        # delta = b - a invariant. Tolerance 0.011 thay vì 0.01 (Phase 28 flake fix):
        # BE rounds delta + a + b mỗi field độc lập tới 2dp → worst-case 3 rounding
        # errors stack có thể vượt 0.01 (vd a=4.78 b=4.84 delta=-0.07 → |delta - (b-a)|
        # = 0.010000000000000397). 0.011 vẫn catch real bug (delta sign flip, off-by-1
        # rounding direction) nhưng không trigger floating-point flake.
        assert abs(sd[metric]["delta"] - (sd[metric]["b"] - sd[metric]["a"])) < 0.011

    # Same data → 0 new entries / removed (cùng 81 stocks ACTIVE survive)
    assert data["new_entries"] == []
    assert data["removed"] == []

    # Score distribution 6 buckets
    sdist = data["score_distribution"]
    assert sdist["buckets"] == ["<30", "30-45", "45-60", "60-75", "75-90", "≥90"]
    assert len(sdist["a_counts"]) == 6 == len(sdist["b_counts"])
    # Sum = scored count
    assert sum(sdist["a_counts"]) == sd["scored"]["a"]
    assert sum(sdist["b_counts"]) == sd["scored"]["b"]
