"""bcrypt hash + verify — TAD c08 §3.

Dùng `bcrypt` trực tiếp thay passlib (passlib 1.7 không tương thích bcrypt 4.x).
"""

import bcrypt


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False
