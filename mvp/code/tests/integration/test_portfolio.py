"""Portfolio CRUD — SRS f11 UC-11-01 AC-11-01..06 + TAD g02 §8.2.

Coverage: 4 endpoints (GET/POST/PUT/DELETE) + 6 validation rules
(ERR-11-02..06 + 404 not-found) + auth + envelope shape.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from app.db.session import SessionLocal
from app.models.portfolio import PortfolioHolding
from sqlalchemy import delete


@pytest.fixture
def clean_portfolio():
    """Wipe portfolio table trước + sau test cho isolation."""
    with SessionLocal() as db:
        db.execute(delete(PortfolioHolding))
        db.commit()
    yield
    with SessionLocal() as db:
        db.execute(delete(PortfolioHolding))
        db.commit()


def _today_str() -> str:
    return datetime.now(UTC).date().isoformat()


def _yesterday_str() -> str:
    return (datetime.now(UTC).date() - timedelta(days=1)).isoformat()


def _tomorrow_str() -> str:
    return (datetime.now(UTC).date() + timedelta(days=1)).isoformat()


def _create_payload(**overrides) -> dict:
    base = {
        "ticker": "VHM",
        "quantity": 1000,
        "buy_price": 35.5,  # ngàn đồng (TAD g02 §M)
        "buy_date": _yesterday_str(),
        "notes": None,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Auth (4 endpoints)
# ---------------------------------------------------------------------------


def test_list_requires_auth(client):
    r = client.get("/api/portfolio")
    assert r.status_code == 401


def test_create_requires_auth(client):
    r = client.post("/api/portfolio", json=_create_payload())
    assert r.status_code == 401


def test_update_requires_auth(client):
    r = client.put("/api/portfolio/1", json={"quantity": 500})
    assert r.status_code == 401


def test_delete_requires_auth(client):
    r = client.delete("/api/portfolio/1")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# AC-11-01: CRUD lifecycle
# ---------------------------------------------------------------------------


def test_list_empty_returns_zero_total(client, auth_headers, clean_portfolio):
    r = client.get("/api/portfolio", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"] == {"items": [], "total": 0}


def test_create_then_list_returns_holding(client, auth_headers, clean_portfolio):
    payload = _create_payload(ticker="VHM", quantity=1000, buy_price=35.5)
    r = client.post("/api/portfolio", json=payload, headers=auth_headers)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["success"] is True
    holding = body["data"]
    assert holding["ticker"] == "VHM"
    assert holding["quantity"] == 1000
    assert holding["buy_price"] == 35.5
    assert holding["buy_date"] == payload["buy_date"]
    assert holding["id"] >= 1
    assert "created_at" in holding
    assert "updated_at" in holding

    r2 = client.get("/api/portfolio", headers=auth_headers)
    body2 = r2.json()["data"]
    assert body2["total"] == 1
    assert body2["items"][0]["ticker"] == "VHM"


def test_create_normalizes_ticker_uppercase(client, auth_headers, clean_portfolio):
    """SRS f11 UC-11-01: backend nhận lowercase → normalize trước whitelist check."""
    payload = _create_payload(ticker="vhm")
    r = client.post("/api/portfolio", json=payload, headers=auth_headers)
    assert r.status_code == 201
    assert r.json()["data"]["ticker"] == "VHM"


def test_update_modifies_fields_and_bumps_updated_at(client, auth_headers, clean_portfolio):
    create = client.post(
        "/api/portfolio", json=_create_payload(quantity=500), headers=auth_headers
    ).json()["data"]
    hid = create["id"]
    original_updated = create["updated_at"]

    r = client.put(
        f"/api/portfolio/{hid}",
        json={"quantity": 750, "notes": "Long-term hold"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    updated = r.json()["data"]
    assert updated["quantity"] == 750
    assert updated["notes"] == "Long-term hold"
    # ticker + buy_price + buy_date giữ nguyên (partial update)
    assert updated["ticker"] == create["ticker"]
    assert updated["buy_price"] == create["buy_price"]
    assert updated["buy_date"] == create["buy_date"]
    # updated_at bumped (trong cùng giây có thể equal — chỉ assert >=)
    assert updated["updated_at"] >= original_updated


def test_delete_returns_envelope_and_removes(client, auth_headers, clean_portfolio):
    """TAD g02 §8.1: DELETE /portfolio/{id} → 200 + {id, deleted: true}."""
    hid = client.post(
        "/api/portfolio", json=_create_payload(), headers=auth_headers
    ).json()["data"]["id"]

    r = client.delete(f"/api/portfolio/{hid}", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"] == {"id": hid, "deleted": True}

    # Verify removed
    list_body = client.get("/api/portfolio", headers=auth_headers).json()["data"]
    assert list_body["total"] == 0


# ---------------------------------------------------------------------------
# AC-11-02: quantity validation → ERR-11-02
# ---------------------------------------------------------------------------


def test_create_quantity_zero_returns_err_11_02(client, auth_headers, clean_portfolio):
    r = client.post("/api/portfolio", json=_create_payload(quantity=0), headers=auth_headers)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-11-02"


def test_create_quantity_negative_returns_err_11_02(client, auth_headers, clean_portfolio):
    r = client.post(
        "/api/portfolio", json=_create_payload(quantity=-10), headers=auth_headers
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-11-02"


def test_create_quantity_decimal_rejected_by_pydantic(client, auth_headers, clean_portfolio):
    """Pydantic int coercion sẽ reject decimal qua 422 ERR-VALIDATION."""
    r = client.post(
        "/api/portfolio", json=_create_payload(quantity=10.5), headers=auth_headers
    )
    # Pydantic strict int rejects 10.5 → 422
    assert r.status_code in (400, 422)


def test_update_quantity_zero_returns_err_11_02(client, auth_headers, clean_portfolio):
    hid = client.post(
        "/api/portfolio", json=_create_payload(), headers=auth_headers
    ).json()["data"]["id"]
    r = client.put(
        f"/api/portfolio/{hid}", json={"quantity": 0}, headers=auth_headers
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-11-02"


# ---------------------------------------------------------------------------
# AC-11-03: buy_price validation → ERR-11-03
# ---------------------------------------------------------------------------


def test_create_price_zero_returns_err_11_03(client, auth_headers, clean_portfolio):
    r = client.post(
        "/api/portfolio", json=_create_payload(buy_price=0.0), headers=auth_headers
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-11-03"


def test_create_price_negative_returns_err_11_03(client, auth_headers, clean_portfolio):
    r = client.post(
        "/api/portfolio", json=_create_payload(buy_price=-5.0), headers=auth_headers
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-11-03"


# ---------------------------------------------------------------------------
# AC-11-04: ticker whitelist → ERR-11-04
# ---------------------------------------------------------------------------


def test_create_ticker_not_in_whitelist_returns_err_11_04(client, auth_headers, clean_portfolio):
    r = client.post(
        "/api/portfolio", json=_create_payload(ticker="ZZZZ"), headers=auth_headers
    )
    assert r.status_code == 400
    body = r.json()
    assert body["error"]["code"] == "ERR-11-04"
    assert "ZZZZ" in body["error"]["message"]


# ---------------------------------------------------------------------------
# AC-11-06: buy_date ≤ TODAY → ERR-11-06 (date format ERR-11-05 Pydantic-trapped)
# ---------------------------------------------------------------------------


def test_create_buy_date_future_returns_err_11_06(client, auth_headers, clean_portfolio):
    r = client.post(
        "/api/portfolio",
        json=_create_payload(buy_date=_tomorrow_str()),
        headers=auth_headers,
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "ERR-11-06"


def test_create_buy_date_today_accepted(client, auth_headers, clean_portfolio):
    r = client.post(
        "/api/portfolio",
        json=_create_payload(buy_date=_today_str()),
        headers=auth_headers,
    )
    assert r.status_code == 201


def test_create_buy_date_invalid_format_returns_422(client, auth_headers, clean_portfolio):
    """Pydantic catch invalid date → 422 ERR-VALIDATION (FE chỉ qua format YYYY-MM-DD)."""
    r = client.post(
        "/api/portfolio", json=_create_payload(buy_date="not-a-date"), headers=auth_headers
    )
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# AC-11-05: derived fields formula — verified frontend (cluster 5).
# Backend chỉ trả raw rows; AC-11-05 không có backend assertion.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 404 not-found cases
# ---------------------------------------------------------------------------


def test_update_unknown_holding_returns_404(client, auth_headers, clean_portfolio):
    r = client.put(
        "/api/portfolio/99999", json={"quantity": 100}, headers=auth_headers
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ERR-NOT-FOUND"


def test_delete_unknown_holding_returns_404(client, auth_headers, clean_portfolio):
    r = client.delete("/api/portfolio/99999", headers=auth_headers)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "ERR-NOT-FOUND"


# ---------------------------------------------------------------------------
# List shape + ordering
# ---------------------------------------------------------------------------


def test_list_orders_by_created_at_desc(client, auth_headers, clean_portfolio):
    """Most recent first — natural for timeline UI."""
    first = client.post(
        "/api/portfolio", json=_create_payload(ticker="VHM"), headers=auth_headers
    ).json()["data"]
    second = client.post(
        "/api/portfolio", json=_create_payload(ticker="KDH"), headers=auth_headers
    ).json()["data"]

    items = client.get("/api/portfolio", headers=auth_headers).json()["data"]["items"]
    assert len(items) == 2
    # Second insert appears first (DESC by created_at)
    assert items[0]["id"] == second["id"]
    assert items[1]["id"] == first["id"]


def test_list_response_shape_per_tad_8_2(client, auth_headers, clean_portfolio):
    """TAD g02 §8.2 PortfolioListResponse: items[]=PortfolioHolding + total."""
    client.post(
        "/api/portfolio", json=_create_payload(notes="growth"), headers=auth_headers
    )
    body = client.get("/api/portfolio", headers=auth_headers).json()
    data = body["data"]
    assert set(data.keys()) == {"items", "total"}
    holding = data["items"][0]
    expected_keys = {
        "id", "ticker", "quantity", "buy_price", "buy_date",
        "notes", "created_at", "updated_at",
    }
    assert set(holding.keys()) == expected_keys
    assert holding["notes"] == "growth"
    # date in YYYY-MM-DD format
    assert len(holding["buy_date"]) == 10
    assert holding["buy_date"][4] == "-"


def test_buy_price_unit_is_ngan_dong_not_raw(client, auth_headers, clean_portfolio):
    """TAD g02 §M: buy_price stored + returned as ngàn đồng (no /1000 conversion)."""
    r = client.post(
        "/api/portfolio", json=_create_payload(buy_price=42.5), headers=auth_headers
    )
    assert r.json()["data"]["buy_price"] == 42.5
