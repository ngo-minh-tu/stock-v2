"""User profile repository — single-user MVP nên chỉ luôn id=1."""

from sqlalchemy.orm import Session

from app.models import UserProfile

SINGLE_USER_ID = 1


def get_user(db: Session) -> UserProfile | None:
    return db.get(UserProfile, SINGLE_USER_ID)


def set_password_hash(db: Session, password_hash: str) -> UserProfile:
    user = db.get(UserProfile, SINGLE_USER_ID)
    if user is None:
        raise RuntimeError("Initial user chưa được seed; chạy app.db.seed trước")
    user.password_hash = password_hash
    db.flush()
    return user
