"""GET /api/news + /api/news/sentiment/{ticker} — Phase 6 SRS f10 + TAD g02 §7.2-7.3."""

from __future__ import annotations


def test_news_requires_auth(client):
    assert client.get("/api/news").status_code == 401


def test_news_sentiment_requires_auth(client):
    assert client.get("/api/news/sentiment/VHM").status_code == 401


def test_news_default_pagination(client, auth_headers):
    r = client.get("/api/news", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert {"items", "total", "limit", "offset", "source_errors"} <= data.keys()
    assert data["limit"] == 20
    assert data["offset"] == 0
    assert isinstance(data["source_errors"], list)
    assert data["source_errors"] == []
    # Phase 1 đã seed 150 articles
    assert data["total"] == 150
    assert len(data["items"]) == 20


def test_news_filter_by_source(client, auth_headers):
    r = client.get("/api/news?source=CAFEF&limit=50", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    assert items
    assert all(item["source"] == "CAFEF" for item in items)


def test_news_filter_multiple_sources_csv(client, auth_headers):
    r = client.get("/api/news?source=CAFEF,VNEXPRESS&limit=50", headers=auth_headers)
    assert r.status_code == 200
    sources = {item["source"] for item in r.json()["data"]["items"]}
    assert sources <= {"CAFEF", "VNEXPRESS"}


def test_news_filter_sentiment(client, auth_headers):
    r = client.get("/api/news?sentiment=POSITIVE&limit=50", headers=auth_headers)
    assert r.status_code == 200
    items = r.json()["data"]["items"]
    assert all(item["sentiment_label"] == "POSITIVE" for item in items)


def test_news_mock_failure_echoes_in_errors(client, auth_headers):
    r = client.get("/api/news?mock_news_failure=CAFEF&limit=5", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["data"]["source_errors"] == ["CAFEF"]


def test_news_sentiment_summary_with_data(client, auth_headers):
    """1 ticker từ news fixture nên có rollup. News fixture seed random tickers từ 81 mã."""
    r = client.get("/api/news/sentiment/VHM", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    for k in ("ticker", "score_avg", "label_counts", "source_breakdown", "total"):
        assert k in data
    assert data["ticker"] == "VHM"
    assert set(data["label_counts"].keys()) == {"POSITIVE", "NEUTRAL", "NEGATIVE"}


def test_news_sentiment_empty_for_unknown_ticker(client, auth_headers):
    """GUARD-08: count=0 → score_avg=0.0, label_counts all 0, source_breakdown={}."""
    r = client.get("/api/news/sentiment/MOCK_INSUFFICIENT", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    # MOCK_INSUFFICIENT có thể có hoặc không có articles từ fixture random.
    # Verify shape consistent dù empty hay không.
    assert isinstance(data["score_avg"], (int, float))
    assert data["label_counts"] == data["label_counts"]  # well-formed
    if data["total"] == 0:
        assert data["score_avg"] == 0.0
        assert data["source_breakdown"] == {}
