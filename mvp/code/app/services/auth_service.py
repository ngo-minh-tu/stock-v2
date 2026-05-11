"""Auth service — login + change password — SRS f16 + f15 UC-15-06."""

from sqlalchemy.orm import Session

from app.constants.error_codes import (
    ERR_AUTH_CURRENT_REQUIRED,
    ERR_AUTH_INVALID_CREDENTIALS,
    ERR_AUTH_NEW_PASSWORD_TOO_SHORT,
)
from app.core.errors import AppError
from app.core.jwt import issue_token
from app.core.password import hash_password, verify_password
from app.repositories import user_repo


def login(db: Session, password: str) -> str:
    """Verify password against single user, return JWT.

    SRS f16 AC-16-02: error message generic — không tiết lộ user/password đúng-sai riêng.
    """
    user = user_repo.get_user(db)
    if user is None or not verify_password(password, user.password_hash):
        raise AppError(ERR_AUTH_INVALID_CREDENTIALS, "Sai mật khẩu", http_status=401)
    return issue_token(user.id)


def change_password(db: Session, current: str, new_password: str) -> str:
    """Verify current → hash new → re-issue JWT.

    SRS f15 UC-15-06: trả token mới để FE update localStorage; FE tự dùng token mới
    cho request kế tiếp (không cần re-login).
    """
    if not current:
        raise AppError(ERR_AUTH_CURRENT_REQUIRED, "Vui lòng nhập mật khẩu hiện tại", http_status=400)
    if len(new_password) < 8:
        raise AppError(
            ERR_AUTH_NEW_PASSWORD_TOO_SHORT,
            "Mật khẩu mới phải có ít nhất 8 ký tự",
            http_status=400,
        )

    user = user_repo.get_user(db)
    if user is None or not verify_password(current, user.password_hash):
        raise AppError(ERR_AUTH_INVALID_CREDENTIALS, "Mật khẩu hiện tại không đúng", http_status=401)

    user.password_hash = hash_password(new_password)
    db.flush()
    return issue_token(user.id)
