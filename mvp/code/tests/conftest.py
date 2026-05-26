"""Global pytest setup.

Tests must never mutate the local demo database. Configure an isolated SQLite
file before importing the app, because app.db.session builds the SQLAlchemy
engine at import time.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DB_PATH", "./data/test-screener.db")


def _resolve_db_path(raw: str) -> Path:
    path = Path(raw)
    if path.is_absolute():
        return path
    return Path(__file__).resolve().parents[1] / path


_db_path = _resolve_db_path(os.environ["DB_PATH"])
if os.environ.get("APP_ENV") == "production":
    raise RuntimeError("Refusing to run tests with APP_ENV=production")
if _db_path.name == "screener.db" or "test" not in _db_path.name:
    raise RuntimeError(f"Refusing to run tests against non-test DB: {_db_path}")

_db_path.parent.mkdir(parents=True, exist_ok=True)
for candidate in (_db_path, _db_path.with_suffix(_db_path.suffix + "-wal"), _db_path.with_suffix(_db_path.suffix + "-shm")):
    if candidate.exists():
        candidate.unlink()

from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

Base.metadata.create_all(bind=engine)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
