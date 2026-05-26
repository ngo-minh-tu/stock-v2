"""News RSS + HTML fallback crawler.

Per SRS f10 / TAD c04 §1:
- Try RSS first
- If RSS fails (404/403/empty/exception) → try HTML scrape
- If both fail → caller adds source code to `source_errors[]`

Output là `list[CrawledArticle]` — chưa qua sentiment/ticker extraction (caller làm sau).
"""

from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from time import mktime
from zoneinfo import ZoneInfo

import feedparser
import httpx
from selectolax.parser import HTMLParser

from app.crawlers.news_sources import SourceConfig

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
)
HTTP_TIMEOUT = 15.0
MAX_ITEMS_PER_SOURCE = 50  # đủ cho 5 nguồn × 50 = 250 articles/crawl
SNIPPET_MAX_CHARS = 200
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
HTML_DATETIME_RE = re.compile(
    r"\b(?P<day>\d{1,2})/(?P<month>\d{1,2})/(?P<year>\d{4})"
    r"(?:\s+(?P<hour>\d{1,2}):(?P<minute>\d{2}))?\b"
)


@dataclass
class CrawledArticle:
    source: str
    title: str
    url: str
    published_at: datetime | None
    content_snippet: str


def _strip_html(text: str) -> str:
    """Loại bỏ tag HTML + decode entities + collapse whitespace."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _truncate_snippet(text: str) -> str:
    cleaned = _strip_html(text)
    if len(cleaned) <= SNIPPET_MAX_CHARS:
        return cleaned
    return cleaned[: SNIPPET_MAX_CHARS - 1].rsplit(" ", 1)[0] + "…"


def _parse_published(entry: dict) -> datetime | None:
    """RSS published_parsed là struct_time UTC. Một số feed trả published string."""
    tup = entry.get("published_parsed") or entry.get("updated_parsed")
    if tup:
        try:
            return datetime.fromtimestamp(mktime(tup), tz=UTC)
        except (ValueError, OverflowError):
            return None
    return None


def _parse_html_published(text: str) -> datetime | None:
    """Parse Vietnamese HTML listing timestamps such as `22/05/2026 17:00`."""
    match = HTML_DATETIME_RE.search(text)
    if not match:
        return None
    try:
        dt = datetime(
            int(match.group("year")),
            int(match.group("month")),
            int(match.group("day")),
            int(match.group("hour") or 0),
            int(match.group("minute") or 0),
            tzinfo=VN_TZ,
        )
    except ValueError:
        return None
    return dt.astimezone(UTC)


def _strip_html_published_prefix(text: str) -> str:
    """Remove leading timestamp/category noise from HTML fallback card text."""
    return re.sub(
        r"^\s*\d{1,2}/\d{1,2}/\d{4}(?:\s+\d{1,2}:\d{2})?"
        r"\s*(?:[•·|-]\s*)?(?:Tin tức\s*)?",
        "",
        text,
        count=1,
        flags=re.IGNORECASE,
    ).strip()


def fetch_rss(source: SourceConfig, *, client: httpx.Client) -> list[CrawledArticle]:
    """RSS path. Raises on HTTP error — caller catch để fallback HTML."""
    if not source.rss_url:
        return []
    r = client.get(source.rss_url, timeout=HTTP_TIMEOUT, follow_redirects=True)
    r.raise_for_status()
    feed = feedparser.parse(r.content)
    out: list[CrawledArticle] = []
    for entry in feed.entries[:MAX_ITEMS_PER_SOURCE]:
        title = _strip_html(entry.get("title", ""))
        link = entry.get("link", "")
        if not title or not link:
            continue
        snippet = _truncate_snippet(entry.get("summary", "") or entry.get("description", ""))
        out.append(
            CrawledArticle(
                source=source.code,
                title=title,
                url=link,
                published_at=_parse_published(entry),
                content_snippet=snippet,
            )
        )
    return out


def fetch_html(source: SourceConfig, *, client: httpx.Client) -> list[CrawledArticle]:
    """HTML fallback path khi RSS không khả dụng."""
    if not source.html_url or not source.html_selector:
        return []
    r = client.get(source.html_url, timeout=HTTP_TIMEOUT, follow_redirects=True)
    r.raise_for_status()
    doc = HTMLParser(r.text)
    out: list[CrawledArticle] = []
    seen_urls: set[str] = set()
    base = _origin(source.html_url)
    fetched_at = datetime.now(UTC)
    for node in doc.css(source.html_selector)[: MAX_ITEMS_PER_SOURCE * 2]:
        node_text = _strip_html(node.text() or "")
        attr_title = _strip_html(
            node.attributes.get("title", "") or node.attributes.get("aria-label", "")
        )
        title = attr_title or _strip_html_published_prefix(node_text)
        href = (node.attributes.get("href") or "").strip()
        if not title or not href or len(title) < 12:
            continue
        url = href if href.startswith("http") else f"{base}{href if href.startswith('/') else '/' + href}"
        if source.code == "BATDONGSAN" and not re.search(r"-\d{5,}/?$", url.split("?", 1)[0]):
            continue
        if url in seen_urls:
            continue
        seen_urls.add(url)
        out.append(
            CrawledArticle(
                source=source.code,
                title=title,
                url=url,
                published_at=_parse_html_published(node_text) or fetched_at,
                content_snippet="",
            )
        )
        if len(out) >= MAX_ITEMS_PER_SOURCE:
            break
    return out


def _origin(url: str) -> str:
    """Extract scheme://host từ URL."""
    m = re.match(r"^(https?://[^/]+)", url)
    return m.group(1) if m else ""


def crawl_source(source: SourceConfig) -> tuple[list[CrawledArticle], str | None]:
    """RSS → HTML fallback → skip. Returns (articles, error_msg or None)."""
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "vi,en;q=0.8"}
    with httpx.Client(headers=headers) as client:
        # Try RSS
        if source.rss_url:
            try:
                articles = fetch_rss(source, client=client)
                if articles:
                    return articles, None
                logger.info("RSS empty for %s, trying HTML fallback", source.code)
            except Exception as e:  # noqa: BLE001 — caller chỉ cần biết failed
                logger.warning("RSS failed for %s: %s", source.code, e)
        # Fallback HTML
        try:
            articles = fetch_html(source, client=client)
            if articles:
                return articles, None
            return [], f"{source.code}: no articles from RSS or HTML"
        except Exception as e:  # noqa: BLE001
            logger.warning("HTML failed for %s: %s", source.code, e)
            return [], f"{source.code}: {type(e).__name__}"
