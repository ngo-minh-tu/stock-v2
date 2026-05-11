"""JWT encode/decode — TAD c08 §3 + SRS f16 AC-16-05.

HS256 + 24h TTL (configurable). Subject = user id (single-user MVP, luôn 1).
"""

import uuid
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import get_settings

ALGORITHM = "HS256"


class TokenError(Exception):
    """Raised khi token invalid/expired/malformed."""


def issue_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_ttl_hours)).timestamp()),
        "jti": uuid.uuid4().hex,  # uniqueness ngay cả khi 2 token issue cùng giây
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> int:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError as e:
        raise TokenError(str(e)) from e
    sub = payload.get("sub")
    if sub is None:
        raise TokenError("missing subject")
    try:
        return int(sub)
    except (TypeError, ValueError) as e:
        raise TokenError("invalid subject") from e
