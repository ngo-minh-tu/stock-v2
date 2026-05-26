"""Idempotent seed script — chạy sau `alembic upgrade head`.

Seed:
- 81 stocks (26 real VN + 5 anchor mocks + 50 fillers) — port từ FE stocks-fixture.ts
- 1 default settings row (id=1, version=1)
- 1 initial user (id=1, password từ env INITIAL_USER_PASSWORD)
- 150 news articles (5 sources, 90-day window, 40/35/25 sentiment distribution)
- 5 cache_metadata rows (1/news source) status=FRESH

Run: `uv run python -m app.db.seed`
Idempotent: re-run không tạo dup; check exist trước insert.
"""

from __future__ import annotations

import json
import logging
import os
import random
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants.enums import NewsSource, SentimentLabel
from app.core.password import hash_password
from app.db.session import SessionLocal
from app.models import (
    CacheMetadata,
    MacroData,
    NewsArticle,
    Stock,
    UserProfile,
)
from app.models import (
    Settings as SettingsRow,
)

logger = logging.getLogger(__name__)


# --- Stock fixture (port từ FE stocks-fixture.ts) ---

REAL_TICKERS: list[tuple[str, str, str]] = [
    ("VHM", "Công ty Cổ phần Vinhomes", "HOSE"),
    ("VIC", "Tập đoàn Vingroup", "HOSE"),
    ("NVL", "Công ty Cổ phần Tập đoàn Đầu tư Địa ốc No Va", "HOSE"),
    ("KDH", "Công ty Cổ phần Đầu tư và Kinh doanh Nhà Khang Điền", "HOSE"),
    ("NLG", "Công ty Cổ phần Đầu tư Nam Long", "HOSE"),
    ("DXG", "Công ty Cổ phần Tập đoàn Đất Xanh", "HOSE"),
    ("PDR", "Công ty Cổ phần Phát triển Bất động sản Phát Đạt", "HOSE"),
    ("KBC", "Tổng Công ty Phát triển Đô thị Kinh Bắc - CTCP", "HOSE"),
    ("BCM", "Tổng Công ty Đầu tư và Phát triển Công nghiệp - CTCP", "HOSE"),
    ("VRE", "Công ty Cổ phần Vincom Retail", "HOSE"),
    ("HDC", "Công ty Cổ phần Phát triển Nhà Bà Rịa - Vũng Tàu", "HOSE"),
    ("IJC", "Công ty Cổ phần Phát triển Hạ tầng Kỹ thuật", "HOSE"),
    ("DIG", "Tổng Công ty Cổ phần Đầu tư Phát triển Xây dựng", "HOSE"),
    ("CEO", "Công ty Cổ phần Tập đoàn C.E.O", "HNX"),
    ("HQC", "Công ty Cổ phần Tư vấn - Thương mại - Dịch vụ Địa ốc Hoàng Quân", "HOSE"),
    ("TIG", "Công ty Cổ phần Tập đoàn Đầu tư Thăng Long", "HNX"),
    ("LDG", "Công ty Cổ phần Đầu tư LDG", "HOSE"),
    ("ITC", "Công ty Cổ phần Đầu tư - Kinh doanh Nhà", "HOSE"),
    ("SCR", "Công ty Cổ phần Địa ốc Sài Gòn Thương Tín", "HOSE"),
    ("AGG", "Công ty Cổ phần Đầu tư và Phát triển Bất động sản An Gia", "HOSE"),
    ("TCH", "Công ty Cổ phần Đầu tư Dịch vụ Tài chính Hoàng Huy", "HOSE"),
    ("HDG", "Công ty Cổ phần Tập đoàn Hà Đô", "HOSE"),
    ("SZC", "Công ty Cổ phần Sonadezi Châu Đức", "HOSE"),
    ("SIP", "Công ty Cổ phần Đầu tư Sài Gòn VRG", "UPCOM"),
    ("KOS", "Công ty Cổ phần Kosy", "HOSE"),
    ("NTL", "Công ty Cổ phần Phát triển Đô thị Từ Liêm", "HOSE"),
]

ANCHOR_MOCKS: list[tuple[str, str, str, str]] = [
    ("MOCK_BUY_STRONG", "Mock Buy Strong", "HOSE", "Residential"),
    ("MOCK_BUY_WARN", "Mock Buy With Warning", "HOSE", "Residential"),
    ("MOCK_HOLD", "Mock Hold", "HOSE", "Industrial Park"),
    ("MOCK_SELL", "Mock Sell", "HNX", "Resort/Hospitality"),
    ("MOCK_INSUFFICIENT", "Mock Insufficient Data", "UPCOM", "Retail/Mixed"),
]

SECTORS = ("Residential", "Industrial Park", "Retail/Mixed", "Resort/Hospitality")
EXCHANGES = ("HOSE", "HNX", "UPCOM")

# 6 anchor mã được mark newly_listed (TAD g02 §7.1 + frontend NEWLY_LISTED_INDEXES {5,17,31,46,58,73})
NEWLY_LISTED_INDEXES = frozenset({5, 17, 31, 46, 58, 73})


def build_stock_seeds() -> list[dict]:
    rows: list[dict] = []
    for i, (ticker, name, exchange) in enumerate(REAL_TICKERS):
        rows.append(
            {
                "ticker": ticker,
                "name": name,
                "exchange": exchange,
                "sector": SECTORS[i % len(SECTORS)],
            }
        )
    for ticker, name, exchange, sector in ANCHOR_MOCKS:
        rows.append({"ticker": ticker, "name": name, "exchange": exchange, "sector": sector})
    for i in range(50):
        idx = i + 1
        rows.append(
            {
                "ticker": f"MOCK{idx:02d}",
                "name": f"Mock Real Estate {idx}",
                "exchange": EXCHANGES[i % 3],
                "sector": SECTORS[i % len(SECTORS)],
            }
        )
    assert len(rows) == 81, f"Expected 81 stocks, got {len(rows)}"
    for i, row in enumerate(rows):
        row["newly_listed"] = i in NEWLY_LISTED_INDEXES
    return rows


# --- News fixture ---

TITLE_TEMPLATES_POS = [
    "{T} công bố lợi nhuận quý tăng {n}%",
    "{T} mở bán dự án mới, hấp thụ vượt kỳ vọng",
    "Chiến lược tái cấu trúc của {T} bắt đầu cho trái ngọt",
    "{T} ký hợp đồng tín dụng {n} tỷ đồng cho dự án trọng điểm",
    "Cổ phiếu {T} bứt phá nhờ kết quả kinh doanh tích cực",
]
TITLE_TEMPLATES_NEU = [
    "{T} tổ chức ĐHCĐ thường niên năm 2026",
    "{T} bổ nhiệm thành viên HĐQT mới",
    "Báo cáo phân tích ngành BĐS quý mới — {T} trong tâm điểm",
    "{T} công bố tài liệu họp cổ đông",
    "Lãi suất giảm tác động trung tính tới nhóm BĐS",
]
TITLE_TEMPLATES_NEG = [
    "{T} gặp vướng mắc pháp lý tại dự án {n}",
    "Doanh thu của {T} sụt giảm {n}% so với cùng kỳ",
    "Áp lực bán mạnh khiến cổ phiếu {T} mất {n}%",
    "{T} bị phạt do công bố thông tin chậm",
    "Cảnh báo nợ xấu gia tăng tại {T}",
    "Cổ đông lớn {T} thoái vốn, cổ phiếu giảm sàn",
]

SNIPPET_POS = [
    "Doanh nghiệp ghi nhận biên lợi nhuận cải thiện rõ rệt nhờ kiểm soát chi phí.",
    "Nhóm phân tích đánh giá triển vọng tích cực với việc bàn giao các dự án mới.",
    "Ban lãnh đạo cho biết kế hoạch mở rộng quỹ đất sẽ tiếp tục là động lực tăng trưởng.",
]
SNIPPET_NEU = [
    "Nội dung cuộc họp tập trung vào kế hoạch sản xuất kinh doanh năm 2026.",
    "Báo cáo cập nhật một số chỉ tiêu vận hành mà không đưa ra điều chỉnh đáng kể.",
    "Thị trường chờ đợi thêm thông tin cụ thể từ phía doanh nghiệp.",
]
SNIPPET_NEG = [
    "Áp lực dòng tiền tiếp tục là rủi ro lớn khi mức nợ vay duy trì ở vùng cao.",
    "Việc chậm hoàn tất pháp lý dự án có thể ảnh hưởng tới kế hoạch ghi nhận doanh thu.",
    "Một số tổ chức đã hạ khuyến nghị, cảnh báo rủi ro pha loãng.",
]

NEWS_FIXTURE_NOW = datetime(2026, 5, 7, 8, 0, 0)
NEWS_TOTAL = 150
NEWS_LOOKBACK_DAYS = 90


def build_news_seeds(stock_tickers: list[str]) -> list[dict]:
    """150 articles, deterministic via random.Random(seed=42).

    Distribution:
    - sources: round-robin across 5 sources (30 each)
    - sentiment: 40% POSITIVE / 35% NEUTRAL / 25% NEGATIVE
    - dates: random within 90 days before NEWS_FIXTURE_NOW
    - related_tickers: 1-2 random tickers per article
    """
    rng = random.Random(42)
    sources = list(NewsSource)
    rows: list[dict] = []

    for i in range(NEWS_TOTAL):
        source = sources[i % len(sources)]
        # sentiment per distribution
        r = rng.random()
        if r < 0.40:
            label = SentimentLabel.POSITIVE
            score = round(rng.uniform(0.3, 0.95), 2)
            tpl_pool = TITLE_TEMPLATES_POS
            snippet = rng.choice(SNIPPET_POS)
        elif r < 0.75:
            label = SentimentLabel.NEUTRAL
            score = round(rng.uniform(-0.2, 0.2), 2)
            tpl_pool = TITLE_TEMPLATES_NEU
            snippet = rng.choice(SNIPPET_NEU)
        else:
            label = SentimentLabel.NEGATIVE
            score = round(rng.uniform(-0.95, -0.3), 2)
            tpl_pool = TITLE_TEMPLATES_NEG
            snippet = rng.choice(SNIPPET_NEG)

        ticker = rng.choice(stock_tickers)
        related = [ticker]
        if rng.random() < 0.3:
            related.append(rng.choice(stock_tickers))

        title = rng.choice(tpl_pool).replace("{T}", ticker).replace("{n}", str(rng.randint(5, 35)))
        days_ago = rng.randint(0, NEWS_LOOKBACK_DAYS)
        hours_offset = rng.randint(0, 23)
        published_at = NEWS_FIXTURE_NOW - timedelta(days=days_ago, hours=hours_offset)
        url = f"https://mock.example/{source.value.lower()}/{i + 1}"

        sentiment_reason = (
            f"Title cites {ticker} với tone {label.value.lower()} (anchor {source.value} {published_at:%Y-%m-%d})."
            if rng.random() > 0.05
            else None  # 5% unavailable per FE GUARD-08
        )

        rows.append(
            {
                "source": source.value,
                "title": title,
                "url": url,
                "published_at": published_at,
                "content_snippet": snippet,
                "related_tickers_json": json.dumps(list(set(related))),
                "sentiment_label": label.value,
                "sentiment_score": score,
                "sentiment_reason": sentiment_reason,
            }
        )

    return rows


# --- Cache metadata rows ---

# Seed 9 sources: 2 vnstock + 2 macro + 5 news. TTL hours từ TAD g04 §1 (qua sources.py).


def build_cache_seeds() -> list[dict]:
    from app.constants.sources import ALL_SOURCES

    rows: list[dict] = []
    for cfg in ALL_SOURCES:
        rows.append(
            {
                "source": cfg.key,
                "last_refreshed_at": None,  # chưa fetch lần nào
                "ttl_hours": cfg.ttl_hours,
                "status": "STALE",  # init STALE để refresh_service biết phải fetch lần đầu
            }
        )
    return rows


# --- Seed runner ---


def seed_stocks(db: Session) -> int:
    rows = build_stock_seeds()
    existing = {s.ticker: s for s in db.scalars(select(Stock)).all()}
    changed = 0
    inserts: list[dict] = []

    for row in rows:
        stock = existing.get(row["ticker"])
        if stock is None:
            inserts.append(row)
            continue
        for field in ("name", "exchange", "sector", "newly_listed"):
            if getattr(stock, field) != row[field]:
                setattr(stock, field, row[field])
                changed += 1

    if inserts:
        db.bulk_insert_mappings(Stock, inserts)
    return len(inserts) + changed


def seed_settings(db: Session) -> int:
    if db.get(SettingsRow, 1) is not None:
        logger.info("settings already exists; skipping")
        return 0
    db.add(SettingsRow(id=1, version=1))
    return 1


def seed_user(db: Session) -> int:
    if db.get(UserProfile, 1) is not None:
        logger.info("user already exists; skipping")
        return 0
    s = get_settings()
    db.add(
        UserProfile(
            id=1,
            email=s.initial_user_email,
            password_hash=hash_password(s.initial_user_password),
        )
    )
    return 1


def seed_news(db: Session) -> int:
    if db.scalar(select(NewsArticle).limit(1)) is not None:
        logger.info("news already seeded; skipping")
        return 0
    tickers = [r["ticker"] for r in build_stock_seeds() if not r["ticker"].startswith("MOCK")]
    rows = build_news_seeds(tickers)
    db.bulk_insert_mappings(NewsArticle, rows)
    return len(rows)


MACRO_DEFAULTS: list[tuple[str, str, float]] = [
    # (indicator, period, value) — chỉ số 2026 hợp lý cho VN BĐS
    ("M01", "2026Q2", 0.05),  # SBV refinance rate 5%
    ("M02", "2026Q2", 0.12),  # Tín dụng BĐS YoY 12%
    ("M03", "2026Q2", 0.035),  # CPI YoY 3.5%
    ("M04", "2026Q2", 4_000_000_000.0),  # FDI 4B USD/year
    ("M05", "2026Q2", 1300.0),  # VN-Index ~1300
]


def seed_macro(db: Session) -> int:
    """Seed M01-M05 stub values cho 2026Q2. Idempotent: skip nếu existing.

    Production refresh-all sẽ upsert macro rows qua `macro_crawler`; seed chỉ giữ
    baseline fallback để engines pipeline luôn có M01-M05 lần boot đầu.
    """
    inserted = 0
    for indicator, period, value in MACRO_DEFAULTS:
        existing = db.scalar(
            select(MacroData).where(
                MacroData.indicator == indicator,
                MacroData.period == period,
            )
        )
        if existing is None:
            db.add(MacroData(indicator=indicator, period=period, value=value, source="seed"))
            inserted += 1
    return inserted


def seed_cache_metadata(db: Session) -> int:
    """Upsert: insert missing sources, sync TTL hours từ config cho rows cũ.

    Cache metadata là **config data** (KHÔNG phải user data) → idempotent sync mỗi seed
    để TTL match TAD g04 hiện tại. Last_refreshed_at + status giữ nguyên (chỉ refresh job mới update).
    """
    rows = build_cache_seeds()
    inserted = 0
    for row in rows:
        existing = db.get(CacheMetadata, row["source"])
        if existing is None:
            db.add(CacheMetadata(**row))
            inserted += 1
        elif existing.ttl_hours != row["ttl_hours"]:
            existing.ttl_hours = row["ttl_hours"]
    return inserted


def run(*, seed_news_fixture: bool | None = None) -> dict[str, int]:
    """Run all seeders. Returns count per entity.

    `seed_news_fixture` — bật seed 150 fixture articles (Phase 9 stopgap).
    Default theo env `SEED_NEWS_FIXTURE` ("1"/"true" → True), else False khi
    APP_ENV=production hoặc unset, True ở test (back-compat cho test_seed.py).
    Real production: gọi POST /api/news/refresh để crawl 5 nguồn thật.
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    if seed_news_fixture is None:
        env_flag = os.environ.get("SEED_NEWS_FIXTURE", "").lower()
        if env_flag in ("1", "true", "yes"):
            seed_news_fixture = True
        elif env_flag in ("0", "false", "no"):
            seed_news_fixture = False
        else:
            # Default: True ở test env (back-compat), False ở real run.
            seed_news_fixture = os.environ.get("APP_ENV", "").lower() == "test"

    counts: dict[str, int] = {}
    with SessionLocal() as db:
        counts["stocks"] = seed_stocks(db)
        counts["settings"] = seed_settings(db)
        counts["user"] = seed_user(db)
        if seed_news_fixture:
            counts["news"] = seed_news(db)
        else:
            counts["news"] = 0
        counts["macro"] = seed_macro(db)
        counts["cache_metadata"] = seed_cache_metadata(db)
        db.commit()
    logger.info("seed counts: %s (news_fixture=%s)", counts, seed_news_fixture)
    return counts


if __name__ == "__main__":
    run()
