"""Verify seed produces expected counts.

Phase 13 moved pytest to an isolated `./data/test-screener.db`; these tests must
never depend on or mutate the local demo database.
"""

from app.db.seed import run as run_seed
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
from sqlalchemy import func, select


def test_seed_produces_expected_counts():
    # Idempotent — call run() ensures DB is seeded; re-call no-ops if already there.
    run_seed()

    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Stock)) == 81
        assert db.scalar(select(func.count()).select_from(SettingsRow)) == 1
        assert db.scalar(select(func.count()).select_from(UserProfile)) == 1
        assert db.scalar(select(func.count()).select_from(NewsArticle)) == 150
        # 9 cache sources: 2 vnstock + 2 macro + 5 news (TAD g04)
        assert db.scalar(select(func.count()).select_from(CacheMetadata)) == 9
        # 5 macro indicators (M01-M05). Macro refresh may add newer periods, so
        # assert indicator coverage instead of total row count.
        assert db.scalar(select(func.count()).select_from(MacroData)) >= 5
        assert db.scalar(select(func.count(func.distinct(MacroData.indicator)))) == 5


def test_seed_anchor_mocks_present():
    expected_anchors = {
        "MOCK_BUY_STRONG",
        "MOCK_BUY_WARN",
        "MOCK_HOLD",
        "MOCK_SELL",
        "MOCK_INSUFFICIENT",
    }
    with SessionLocal() as db:
        tickers = set(db.scalars(select(Stock.ticker)).all())
    missing = expected_anchors - tickers
    assert not missing, f"Missing anchor mocks: {missing}"


def test_seed_news_distribution():
    """40/35/25 sentiment distribution với tolerance ±5%."""
    with SessionLocal() as db:
        total = db.scalar(select(func.count()).select_from(NewsArticle))
        pos = db.scalar(
            select(func.count()).select_from(NewsArticle).where(
                NewsArticle.sentiment_label == "POSITIVE"
            )
        )
        neu = db.scalar(
            select(func.count()).select_from(NewsArticle).where(
                NewsArticle.sentiment_label == "NEUTRAL"
            )
        )
        neg = db.scalar(
            select(func.count()).select_from(NewsArticle).where(
                NewsArticle.sentiment_label == "NEGATIVE"
            )
        )
    assert total == 150
    assert abs(pos / total - 0.40) < 0.05
    assert abs(neu / total - 0.35) < 0.05
    assert abs(neg / total - 0.25) < 0.05


def test_seed_settings_defaults():
    with SessionLocal() as db:
        s = db.get(SettingsRow, 1)
    assert s is not None
    assert s.version == 1
    assert s.buy_threshold == 75
    assert s.hold_min_threshold == 45
    assert s.theme == "CLASSIC"
    assert s.classic_mode == "DARK"
    assert s.language == "VIE"
    assert s.telegram_enabled is False


def test_seed_user_password_hashable():
    from app.core.password import verify_password

    with SessionLocal() as db:
        u = db.get(UserProfile, 1)
    assert u is not None
    # Password from .env.example default — only valid if dev still uses default
    assert verify_password("ChangeMe123!", u.password_hash) is True
    assert verify_password("wrong", u.password_hash) is False
