"""News crawler parsing guards."""

from __future__ import annotations

from datetime import UTC

from app.crawlers.news_rss import _parse_html_published, _strip_html_published_prefix


def test_parse_html_published_vietnamese_listing_timestamp():
    dt = _parse_html_published("22/05/2026 17:00 • Tin tức")

    assert dt is not None
    assert dt.tzinfo == UTC
    assert dt.isoformat() == "2026-05-22T10:00:00+00:00"


def test_strip_html_published_prefix_keeps_article_title():
    title = _strip_html_published_prefix(
        "22/05/2026 17:00 • Tin tứcVietnam Land mở bán dự án mới"
    )

    assert title == "Vietnam Land mở bán dự án mới"
