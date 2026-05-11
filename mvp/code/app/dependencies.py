"""FastAPI dependencies — DB session + auth user.

Pattern: `Annotated[Session, Depends(get_db)]` cho service injection,
`Annotated[UserProfile, Depends(get_current_user)]` cho protected routes.
"""

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.constants.error_codes import ERR_AUTH_UNAUTHORIZED
from app.core.errors import AppError
from app.core.jwt import TokenError, decode_token
from app.db.session import get_db
from app.models import UserProfile

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> UserProfile:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError(ERR_AUTH_UNAUTHORIZED, "Yêu cầu đăng nhập", http_status=401)
    token = authorization.split(" ", 1)[1].strip()
    try:
        user_id = decode_token(token)
    except TokenError as e:
        raise AppError(ERR_AUTH_UNAUTHORIZED, "Phiên đăng nhập hết hạn", http_status=401, detail=str(e)) from e
    user = db.get(UserProfile, user_id)
    if user is None:
        raise AppError(ERR_AUTH_UNAUTHORIZED, "Phiên đăng nhập không hợp lệ", http_status=401)
    return user


CurrentUser = Annotated[UserProfile, Depends(get_current_user)]
