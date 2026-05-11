"""SQLite PRAGMA setup — TAD g07 §B.

3 pragma bắt buộc:
- WAL: cho phép reader song song với writer (single-instance MVP đủ).
- foreign_keys=ON: enforce FK constraints (SQLite default OFF — phải explicit).
- busy_timeout: chờ N ms khi DB locked thay vì lỗi ngay (giảm SQLITE_BUSY).
"""

from typing import Any


def apply_sqlite_pragmas(dbapi_connection: Any, busy_timeout_ms: int) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute(f"PRAGMA busy_timeout={int(busy_timeout_ms)}")
    cursor.close()
