"""Verify SQLite pragmas đã apply đúng cho mỗi connection."""

from app.db.session import engine
from sqlalchemy import text


def test_journal_mode_is_wal():
    with engine.connect() as conn:
        mode = conn.scalar(text("PRAGMA journal_mode"))
    assert str(mode).lower() == "wal"


def test_foreign_keys_enabled():
    with engine.connect() as conn:
        fk = conn.scalar(text("PRAGMA foreign_keys"))
    assert int(fk) == 1


def test_busy_timeout_set():
    with engine.connect() as conn:
        bt = conn.scalar(text("PRAGMA busy_timeout"))
    assert int(bt) >= 1000  # default config = 5000


def test_synchronous_normal():
    with engine.connect() as conn:
        s = conn.scalar(text("PRAGMA synchronous"))
    assert int(s) == 1  # NORMAL
