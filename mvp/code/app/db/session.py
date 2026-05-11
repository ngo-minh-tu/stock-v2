"""SQLAlchemy engine + session factory.

Pattern: 1 engine cho process; SessionLocal là sessionmaker; `get_db()` dependency
yield session per request, đóng sau (đảm bảo connection trả về pool).
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings
from app.db.pragmas import apply_sqlite_pragmas


class Base(DeclarativeBase):
    """Declarative base — mọi ORM model kế thừa."""


def _build_engine() -> Engine:
    settings = get_settings()
    engine = create_engine(
        settings.database_url,
        # SQLite single-thread default → cần check_same_thread=False để FastAPI request handlers
        # (worker threads) cùng share engine. Per-request session vẫn isolated.
        connect_args={"check_same_thread": False},
        echo=False,
        future=True,
    )

    # Wire pragmas mỗi connection mới
    @event.listens_for(engine, "connect")
    def _set_pragmas(dbapi_connection, _):
        apply_sqlite_pragmas(dbapi_connection, settings.db_busy_timeout_ms)

    return engine


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: yield Session, đảm bảo close sau request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
