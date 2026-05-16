"""Cache freshness gate — TAD g04 §2."""

from datetime import UTC, datetime, timedelta

import pytest
from app.crawlers import cache_manager
from app.db.session import SessionLocal
from app.models import CacheMetadata


@pytest.fixture
def db_session():
    with SessionLocal() as db:
        yield db


@pytest.fixture
def temp_source(db_session):
    """Insert a temp cache_metadata row, cleanup after test."""
    src = "test_temp_source"
    row = CacheMetadata(source=src, ttl_hours=4)
    db_session.add(row)
    db_session.commit()
    yield src
    db_session.delete(db_session.get(CacheMetadata, src))
    db_session.commit()


def test_stale_when_metadata_missing(db_session):
    assert cache_manager.is_stale(db_session, "nonexistent_source") is True


def test_stale_when_no_last_refreshed(db_session, temp_source):
    # Row exists but never refreshed
    assert cache_manager.is_stale(db_session, temp_source) is True


def test_fresh_within_ttl(db_session, temp_source):
    row = db_session.get(CacheMetadata, temp_source)
    row.last_refreshed_at = datetime.now(UTC) - timedelta(hours=2)
    row.ttl_hours = 4
    db_session.commit()
    assert cache_manager.is_stale(db_session, temp_source) is False


def test_stale_after_ttl(db_session, temp_source):
    row = db_session.get(CacheMetadata, temp_source)
    row.last_refreshed_at = datetime.now(UTC) - timedelta(hours=10)
    row.ttl_hours = 4
    db_session.commit()
    assert cache_manager.is_stale(db_session, temp_source) is True


def test_fresh_at_explicit_now(db_session, temp_source):
    row = db_session.get(CacheMetadata, temp_source)
    fixed_now = datetime(2026, 5, 10, 12, 0, 0, tzinfo=UTC)
    row.last_refreshed_at = fixed_now - timedelta(hours=3)
    row.ttl_hours = 4
    db_session.commit()
    assert cache_manager.is_stale(db_session, temp_source, now=fixed_now) is False


def test_mark_refreshed_updates_row(db_session, temp_source):
    cache_manager.mark_refreshed(db_session, temp_source)
    db_session.commit()
    row = db_session.get(CacheMetadata, temp_source)
    assert row.last_refreshed_at is not None
    assert row.status == "FRESH"
    assert cache_manager.is_stale(db_session, temp_source) is False


# ---------------------------------------------------------------------------
# is_usable() — TTL AND status==FRESH gate
# ---------------------------------------------------------------------------


def test_usable_false_when_metadata_missing(db_session):
    assert cache_manager.is_usable(db_session, "nonexistent_source") is False


def test_usable_false_when_no_last_refreshed(db_session, temp_source):
    assert cache_manager.is_usable(db_session, temp_source) is False


def test_usable_true_when_fresh_within_ttl(db_session, temp_source):
    row = db_session.get(CacheMetadata, temp_source)
    row.last_refreshed_at = datetime.now(UTC) - timedelta(hours=2)
    row.ttl_hours = 4
    row.status = "FRESH"
    db_session.commit()
    assert cache_manager.is_usable(db_session, temp_source) is True


def test_usable_false_after_ttl_expired(db_session, temp_source):
    row = db_session.get(CacheMetadata, temp_source)
    row.last_refreshed_at = datetime.now(UTC) - timedelta(hours=10)
    row.ttl_hours = 4
    row.status = "FRESH"
    db_session.commit()
    assert cache_manager.is_usable(db_session, temp_source) is False


def test_usable_false_when_status_stub_even_if_ttl_ok(db_session, temp_source):
    """Regression: status=STUB within TTL must NOT be considered usable.

    Bug history: financial cache marked STUB by refresh_service (Phase 9 — crawler
    chưa thật), but is_stale() ignored status → downstream screening thought data
    was fresh and skipped DATA_FROM_CACHE warning. is_usable() closes that gap.
    """
    row = db_session.get(CacheMetadata, temp_source)
    row.last_refreshed_at = datetime.now(UTC) - timedelta(hours=1)  # TTL still valid
    row.ttl_hours = 4
    row.status = "STUB"
    db_session.commit()
    # TTL-only `is_stale` says still-fresh (intentional — refresh job is TTL-driven)
    assert cache_manager.is_stale(db_session, temp_source) is False
    # But status-aware `is_usable` rejects STUB
    assert cache_manager.is_usable(db_session, temp_source) is False


def test_usable_false_when_status_arbitrary_non_fresh(db_session, temp_source):
    row = db_session.get(CacheMetadata, temp_source)
    row.last_refreshed_at = datetime.now(UTC) - timedelta(hours=1)
    row.ttl_hours = 4
    row.status = "PARTIAL"
    db_session.commit()
    assert cache_manager.is_usable(db_session, temp_source) is False


def test_usable_at_explicit_now(db_session, temp_source):
    row = db_session.get(CacheMetadata, temp_source)
    fixed_now = datetime(2026, 5, 10, 12, 0, 0, tzinfo=UTC)
    row.last_refreshed_at = fixed_now - timedelta(hours=3)
    row.ttl_hours = 4
    row.status = "FRESH"
    db_session.commit()
    assert cache_manager.is_usable(db_session, temp_source, now=fixed_now) is True
