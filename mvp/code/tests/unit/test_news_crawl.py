"""Unit tests cho news_crawl_service.refresh_news — dedup URL toàn cục + ghi 1 lần.

Regression cho lỗi "Cập nhật tin tức → Lỗi máy chủ nội bộ" (2026-06-03):
- Cũ: dedup theo từng nguồn nhưng `news_articles.url` UNIQUE toàn cục → 2 nguồn
  trả cùng 1 URL → IntegrityError ở commit → 500.
- Cũ: transaction (purge) mở từ đầu rồi crawl ~61s mới commit → giữ SQLite
  write-lock suốt thời gian network → request refresh thứ 2 `database is locked`.

Test mock `crawl_source` nên không chạm network; verify hành vi dedup + counts.
"""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import app.models  # noqa: F401 — register tất cả model vào Base.metadata
import pytest
from app.crawlers.news_rss import CrawledArticle
from app.db.session import Base
from app.models import NewsArticle
from app.services import news_crawl_service
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def session():
    engine = create_engine("sqlite://")  # in-memory, isolated mỗi test
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    yield db
    db.close()


def _article(source: str, url: str, *, title: str = "Cổ phiếu ngân hàng tăng mạnh phiên hôm nay") -> CrawledArticle:
    return CrawledArticle(
        source=source,
        title=title,
        url=url,
        published_at=datetime(2026, 6, 1, tzinfo=UTC),
        content_snippet="Thị trường tích cực.",
    )


def _patch_sources(monkeypatch, per_source: dict[str, list[CrawledArticle]]):
    """Stub SOURCES + crawl_source để trả articles cố định theo source code."""
    sources = [SimpleNamespace(code=code) for code in per_source]
    monkeypatch.setattr(news_crawl_service, "SOURCES", sources)
    monkeypatch.setattr(
        news_crawl_service,
        "crawl_source",
        lambda cfg: (per_source.get(cfg.code, []), None),
    )


def test_cross_source_duplicate_url_does_not_crash(session, monkeypatch):
    """2 nguồn trả cùng URL → insert 1 lần, không IntegrityError (regression 500)."""
    shared = "https://example.vn/bai-viet-chung"
    _patch_sources(
        monkeypatch,
        {
            "CAFEF": [_article("CAFEF", shared), _article("CAFEF", "https://example.vn/cafef-2")],
            "VNEXPRESS": [_article("VNEXPRESS", shared)],  # trùng URL với CAFEF
        },
    )

    res = news_crawl_service.refresh_news(session)

    rows = list(session.scalars(select(NewsArticle)))
    assert {r.url for r in rows} == {shared, "https://example.vn/cafef-2"}
    assert res["inserted"] == 2
    assert res["skipped_duplicate"] == 1  # 3 crawled - 2 unique = 1 in-batch dup
    assert res["source_errors"] == []
    # Invariant: tổng crawled = inserted + skipped
    assert sum(res["counts_per_source"].values()) == res["inserted"] + res["skipped_duplicate"]


def test_existing_url_skipped_not_reinserted(session, monkeypatch):
    """URL đã có trong DB → skipped_duplicate, không tạo row mới."""
    url = "https://example.vn/da-co"
    session.add(
        NewsArticle(source="CAFEF", title="Bài cũ", url=url, published_at=datetime(2026, 5, 1, tzinfo=UTC))
    )
    session.commit()

    _patch_sources(monkeypatch, {"CAFEF": [_article("CAFEF", url)]})
    res = news_crawl_service.refresh_news(session)

    assert res["inserted"] == 0
    assert res["skipped_duplicate"] == 1
    assert len(list(session.scalars(select(NewsArticle)))) == 1


def test_backfills_published_at_when_existing_row_missing_it(session, monkeypatch):
    """Row cũ thiếu published_at → refresh điền lại từ bài mới (giữ hành vi cũ)."""
    url = "https://example.vn/thieu-ngay"
    session.add(NewsArticle(source="CAFEF", title="Cũ", url=url, published_at=None))
    session.commit()

    _patch_sources(monkeypatch, {"CAFEF": [_article("CAFEF", url, title="Tiêu đề mới")]})
    news_crawl_service.refresh_news(session)

    row = session.scalars(select(NewsArticle).where(NewsArticle.url == url)).one()
    assert row.published_at == datetime(2026, 6, 1)  # naive sau khi qua SQLite
    assert row.title == "Tiêu đề mới"


def test_source_error_recorded_not_raised(session, monkeypatch):
    """Nguồn lỗi (crawl_source trả err) → source_errors[], vẫn 200 (SRS AC-10-01)."""
    sources = [SimpleNamespace(code="CAFEF"), SimpleNamespace(code="VNEXPRESS")]
    monkeypatch.setattr(news_crawl_service, "SOURCES", sources)

    def fake_crawl(cfg):
        if cfg.code == "VNEXPRESS":
            return [], "VNEXPRESS: blocked"
        return [_article("CAFEF", "https://example.vn/ok")], None

    monkeypatch.setattr(news_crawl_service, "crawl_source", fake_crawl)
    res = news_crawl_service.refresh_news(session)

    assert res["source_errors"] == ["VNEXPRESS"]
    assert res["counts_per_source"] == {"CAFEF": 1, "VNEXPRESS": 0}
    assert res["inserted"] == 1
