def test_health_returns_ok_envelope(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert body["data"]["active_job"] is None


def test_version_returns_envelope(client):
    r = client.get("/api/version")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    data = body["data"]
    assert data["app_version"] == "0.1.0"
    assert data["prd_version"] == "v0.5A"
    assert data["db_tables"] == 16
