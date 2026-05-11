"""Auth endpoints — POST /auth/login, PUT /auth/password."""

from fastapi import APIRouter

from app.core.envelope import success
from app.dependencies import CurrentUser, DbSession
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    PasswordChangeResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(req: LoginRequest, db: DbSession) -> dict:
    token = auth_service.login(db, req.password)
    db.commit()
    return success(LoginResponse(token=token).model_dump())


@router.put("/password")
def change_password(
    req: PasswordChangeRequest,
    db: DbSession,
    _user: CurrentUser,
) -> dict:
    """Yêu cầu đã login (Bearer token) — đổi mật khẩu của user hiện tại."""
    new_token = auth_service.change_password(db, req.current, req.new_password)
    db.commit()
    return success(PasswordChangeResponse(token=new_token).model_dump())
