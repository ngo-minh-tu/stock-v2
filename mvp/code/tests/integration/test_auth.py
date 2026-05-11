"""POST /auth/login + PUT /auth/password — SRS f16 + f15 UC-15-06."""


def test_login_success_returns_token(client):
    r = client.post("/api/auth/login", json={"password": "ChangeMe123!"})
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert isinstance(body["data"]["token"], str)
    assert len(body["data"]["token"]) > 20  # JWT-ish


def test_login_wrong_password_401_envelope(client):
    r = client.post("/api/auth/login", json={"password": "wrong"})
    assert r.status_code == 401
    body = r.json()
    assert body["success"] is False
    assert body["error"]["code"] == "ERR-AUTH-INVALID-CREDENTIALS"
    # SRS f16 AC-16-02: generic message, không tiết lộ "user not found"
    assert "Sai mật khẩu" in body["error"]["message"]


def test_login_missing_password_422(client):
    r = client.post("/api/auth/login", json={})
    assert r.status_code == 422


def test_change_password_requires_auth(client):
    r = client.put("/api/auth/password", json={"current": "ChangeMe123!", "new": "Whatever12345"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "ERR-AUTH-UNAUTHORIZED"


def test_change_password_wrong_current_401(client, auth_headers):
    r = client.put(
        "/api/auth/password",
        json={"current": "wrong", "new": "Whatever12345"},
        headers=auth_headers,
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "ERR-AUTH-INVALID-CREDENTIALS"


def test_change_password_short_new_400(client, auth_headers):
    r = client.put(
        "/api/auth/password",
        json={"current": "ChangeMe123!", "new": "short"},
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-AUTH-02"


def test_change_password_success_reissues_token(client, auth_headers, restore_user_password):
    new_pw = "NewPassword456!"
    r = client.put(
        "/api/auth/password",
        json={"current": "ChangeMe123!", "new": new_pw},
        headers=auth_headers,
    )
    assert r.status_code == 200
    new_token = r.json()["data"]["token"]
    assert isinstance(new_token, str)
    assert new_token != auth_headers["Authorization"].split(" ")[1]

    # New token works
    r2 = client.get("/api/settings", headers={"Authorization": f"Bearer {new_token}"})
    assert r2.status_code == 200

    # Old password no longer logs in
    r3 = client.post("/api/auth/login", json={"password": "ChangeMe123!"})
    assert r3.status_code == 401

    # New password logs in
    r4 = client.post("/api/auth/login", json={"password": new_pw})
    assert r4.status_code == 200
