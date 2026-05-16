"""GET /settings + PUT /settings — SRS f15 UC-15-01 + UC-15-07 effective-state."""


def test_get_settings_requires_auth(client):
    r = client.get("/api/settings")
    assert r.status_code == 401


def test_get_settings_returns_full_state(client, auth_headers):
    r = client.get("/api/settings", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    data = body["data"]
    # Defaults seeded từ Phase 1
    assert data["buy_threshold"] == 75
    assert data["hold_min_threshold"] == 45
    assert data["theme"] == "CLASSIC"
    assert data["classic_mode"] == "DARK"
    assert data["language"] == "VIE"
    assert data["telegram_enabled"] is False
    assert "settings_version" in data
    assert "updated_at" in data
    # password_hash KHÔNG được trả
    assert "password_hash" not in data


def test_put_settings_requires_auth(client):
    r = client.put("/api/settings", json={"language": "ENG"})
    assert r.status_code == 401


def test_put_settings_single_field_bumps_version(client, auth_headers, restore_settings):
    before = client.get("/api/settings", headers=auth_headers).json()["data"]["settings_version"]
    r = client.put("/api/settings", json={"language": "ENG"}, headers=auth_headers)
    assert r.status_code == 200
    after = r.json()["data"]
    assert after["language"] == "ENG"
    assert after["settings_version"] == before + 1


def test_put_settings_threshold_violation_400(client, auth_headers, restore_settings):
    """buy_threshold ≤ hold_min_threshold → ERR-15-01 (cross-field)."""
    r = client.put(
        "/api/settings",
        json={"buy_threshold": 40, "hold_min_threshold": 50},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-15-01"


def test_put_settings_threshold_out_of_range_400(client, auth_headers, restore_settings):
    """buy_threshold ngoài 50-95 → ERR-15-01."""
    r = client.put(
        "/api/settings",
        json={"buy_threshold": 99},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-15-01"


def test_put_settings_telegram_enabled_empty_chat_400(client, auth_headers, restore_settings):
    """telegram_enabled=true + chat_id rỗng → ERR-15-02."""
    r = client.put(
        "/api/settings",
        json={"telegram_enabled": True},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-15-02"


def test_put_settings_effective_state_single_field_does_not_spuriously_fail(
    client, auth_headers, restore_settings
):
    """SRS f15 UC-15-07: nếu telegram_enabled đã true với chat+token đầy đủ, PUT
    {language: ENG} KHÔNG được fail spurious — validation phải dựa effective state."""
    # Setup: bật telegram + điền đủ field
    r = client.put(
        "/api/settings",
        json={
            "telegram_enabled": True,
            "telegram_chat_id": "abc",
            "telegram_token": "xyz",
        },
        headers=auth_headers,
    )
    assert r.status_code == 200

    # Single-field PUT không touch telegram → phải pass
    r2 = client.put("/api/settings", json={"language": "ENG"}, headers=auth_headers)
    assert r2.status_code == 200, r2.json()
    assert r2.json()["data"]["language"] == "ENG"
    assert r2.json()["data"]["telegram_enabled"] is True


def test_put_settings_invalid_theme_400(client, auth_headers, restore_settings):
    r = client.put("/api/settings", json={"theme": "NEON"}, headers=auth_headers)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-15-04"


def test_put_settings_telegram_top_n_invalid_400(client, auth_headers, restore_settings):
    r = client.put("/api/settings", json={"telegram_top_n": 10}, headers=auth_headers)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-15-03"
