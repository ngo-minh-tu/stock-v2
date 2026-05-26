"""5 nguồn tin chính thống — config URL RSS + HTML fallback selector.

SRS f10 / TAD c04 §1: RSS first → HTML fallback → skip if blocked.
Mỗi nguồn có 1 RSS URL primary. Batdongsan RSS 403 → đi thẳng HTML.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class SourceConfig:
    code: str            # NewsSource enum: CAFEF | VNEXPRESS | VIETSTOCK | BATDONGSAN | THANHNIEN
    display_name: str    # User-facing name
    rss_url: str | None  # None → HTML-only
    html_url: str | None # HTML fallback page với danh sách bài
    html_selector: str | None  # CSS selector cho thẻ <a> link bài


SOURCES: tuple[SourceConfig, ...] = (
    SourceConfig(
        code="CAFEF",
        display_name="CafeF",
        rss_url="https://cafef.vn/thi-truong-chung-khoan.rss",
        html_url="https://cafef.vn/thi-truong-chung-khoan.chn",
        html_selector="h3 a",
    ),
    SourceConfig(
        code="VNEXPRESS",
        display_name="VnExpress",
        rss_url="https://vnexpress.net/rss/kinh-doanh.rss",
        html_url="https://vnexpress.net/kinh-doanh",
        html_selector="h3.title-news a",
    ),
    SourceConfig(
        code="VIETSTOCK",
        display_name="Vietstock",
        rss_url="https://vietstock.vn/830/chung-khoan/co-phieu.rss",
        html_url="https://vietstock.vn/chung-khoan.htm",
        html_selector="h4 a, h3 a",
    ),
    SourceConfig(
        code="BATDONGSAN",
        display_name="Batdongsan.com.vn",
        rss_url=None,  # 403 — skip RSS
        html_url="https://batdongsan.com.vn/tin-tuc",
        html_selector='a[href*="/tin-tuc/"]',
    ),
    SourceConfig(
        code="THANHNIEN",
        display_name="ThanhNien",
        rss_url="https://thanhnien.vn/rss/kinh-te.rss",
        html_url="https://thanhnien.vn/kinh-te.htm",
        html_selector="h3.story__title a, h2 a",
    ),
)


def get_source_by_code(code: str) -> SourceConfig | None:
    for s in SOURCES:
        if s.code == code:
            return s
    return None
