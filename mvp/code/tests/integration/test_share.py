"""Share Link endpoints — TAD g02 §9.2 + SRS f13 UC-13-02 AC-13-04..18.

Coverage: 4 endpoints + auth + public route bypass + token expiry + delete envelope.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from app.db.session import SessionLocal
from app.models.share import ShareLink
from sqlalchemy import delete


@pytest.fixture
def clean_shares():
    """Wipe share_links trước + sau test."""
    with SessionLocal() as db:
        db.execute(delete(ShareLink))
        db.commit()
    yield
    with SessionLocal() as db:
        db.execute(delete(ShareLink))
        db.commit()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_create_requires_auth(client):
    assert client.post("/api/share", json={"run_id": "any"}).status_code == 401


def test_list_requires_auth(client):
    assert client.get("/api/share").status_code == 401


def test_delete_requires_auth(client):
    assert client.delete("/api/share/some_token").status_code == 401


def test_public_view_does_NOT_require_auth(client):
    """AC-13-04: GET /share/{token} bypass auth — invalid token returns 404 (KHÔNG 401)."""
    r = client.get("/api/share/nonexistent_token")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ERR-13-02"


# ---------------------------------------------------------------------------
# CRUD lifecycle
# ---------------------------------------------------------------------------


def test_create_then_list_then_view_then_delete(client, auth_headers, completed_run, clean_shares):
    # CREATE
    r = client.post(
        "/api/share",
        json={"run_id": completed_run, "expires_in_days": 7},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()["data"]
    assert {"token", "run_id", "url", "created_at", "expires_at"} == set(body.keys())
    token = body["token"]
    assert body["url"] == f"/share/{token}"  # relative path per TAD c06 §4
    assert body["run_id"] == completed_run
    # token = uuid v4 (36 chars with hyphens)
    assert len(token) == 36 and token.count("-") == 4

    # LIST
    lr = client.get("/api/share", headers=auth_headers)
    assert lr.status_code == 200
    items = lr.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["token"] == token

    # PUBLIC VIEW (no auth header)
    pv = client.get(f"/api/share/{token}")
    assert pv.status_code == 200, pv.text
    pv_data = pv.json()["data"]
    assert pv_data["token"] == token
    assert pv_data["run_id"] == completed_run
    assert "data" in pv_data
    assert "summary" in pv_data["data"]
    assert "dashboard" in pv_data["data"]
    assert "top_mua" in pv_data["data"]
    assert isinstance(pv_data["data"]["top_mua"], list)

    # DELETE
    dr = client.delete(f"/api/share/{token}", headers=auth_headers)
    assert dr.status_code == 200
    assert dr.json()["data"] == {"token": token, "deleted": True}

    # AFTER DELETE: public view 404
    after = client.get(f"/api/share/{token}")
    assert after.status_code == 404


# ---------------------------------------------------------------------------
# Validation / edge cases
# ---------------------------------------------------------------------------


def test_create_unknown_run_returns_404(client, auth_headers, clean_shares):
    r = client.post(
        "/api/share",
        json={"run_id": "run_does_not_exist"},
        headers=auth_headers,
    )
    assert r.status_code == 404


def test_expired_token_returns_404(client, auth_headers, completed_run, clean_shares):
    """Manually expire a token → public GET returns 404 ERR-13-02."""
    create = client.post(
        "/api/share",
        json={"run_id": completed_run, "expires_in_days": 7},
        headers=auth_headers,
    ).json()["data"]
    token = create["token"]

    # Force-expire trong DB
    with SessionLocal() as db:
        from app.repositories import share_repo

        row = share_repo.get_by_token(db, token)
        row.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
        db.commit()

    r = client.get(f"/api/share/{token}")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ERR-13-02"


def test_list_excludes_expired(client, auth_headers, completed_run, clean_shares):
    """Expired link KHÔNG trong list active."""
    t1 = client.post(
        "/api/share", json={"run_id": completed_run}, headers=auth_headers
    ).json()["data"]["token"]
    t2 = client.post(
        "/api/share", json={"run_id": completed_run}, headers=auth_headers
    ).json()["data"]["token"]

    # Expire t1
    with SessionLocal() as db:
        from app.repositories import share_repo

        row = share_repo.get_by_token(db, t1)
        row.expires_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
        db.commit()

    items = client.get("/api/share", headers=auth_headers).json()["data"]["items"]
    tokens = [i["token"] for i in items]
    assert t2 in tokens
    assert t1 not in tokens


def test_default_ttl_is_7_days(client, auth_headers, completed_run, clean_shares):
    """No expires_in_days in body → default SHARE_DEFAULT_EXPIRES_DAYS=7."""
    r = client.post("/api/share", json={"run_id": completed_run}, headers=auth_headers)
    body = r.json()["data"]
    created = datetime.fromisoformat(body["created_at"])
    expires = datetime.fromisoformat(body["expires_at"])
    delta = expires - created
    # Allow ±1 second tolerance
    assert abs(delta.total_seconds() - 7 * 24 * 3600) < 5


def test_delete_unknown_token_returns_404(client, auth_headers, clean_shares):
    r = client.delete("/api/share/nonexistent_token", headers=auth_headers)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ERR-NOT-FOUND"
