"""Settings service — GET + PATCH với effective-state validation.

Effective-state pattern (SRS f15 UC-15-07): merge current+patch → check cross-field
trên merged state. Single-field PUT không spurious fail.
"""

from sqlalchemy.orm import Session

from app.constants.enums import ClassicMode, Language, Theme
from app.constants.error_codes import (
    ERR_SETTINGS_CLASSIC_MODE,
    ERR_SETTINGS_LANGUAGE,
    ERR_SETTINGS_TELEGRAM_EMPTY,
    ERR_SETTINGS_THEME,
    ERR_SETTINGS_THRESHOLD,
    ERR_SETTINGS_TOP_N,
)
from app.constants.thresholds import (
    BUY_THRESHOLD_MAX,
    BUY_THRESHOLD_MIN,
    HOLD_MIN_THRESHOLD_MAX,
    HOLD_MIN_THRESHOLD_MIN,
    TELEGRAM_TOP_N_OPTIONS,
)
from app.core.errors import AppError
from app.models import Settings as SettingsRow
from app.repositories import settings_repo


def get_current(db: Session) -> SettingsRow:
    return settings_repo.get_settings_row(db)


def validate_patch(current: SettingsRow, patch: dict) -> None:
    """Effective-state validation (UC-15-07). Raise AppError nếu fail."""
    # Build merged state
    merged: dict = {
        "buy_threshold": current.buy_threshold,
        "hold_min_threshold": current.hold_min_threshold,
        "telegram_enabled": current.telegram_enabled,
        "telegram_chat_id": current.telegram_chat_id,
        "telegram_token": current.telegram_token,
        "telegram_top_n": current.telegram_top_n,
        "theme": current.theme,
        "classic_mode": current.classic_mode,
        "language": current.language,
    }
    merged.update({k: v for k, v in patch.items() if v is not None})

    # Threshold range + cross-field
    bt = int(merged["buy_threshold"])
    hm = int(merged["hold_min_threshold"])
    if not (BUY_THRESHOLD_MIN <= bt <= BUY_THRESHOLD_MAX):
        raise AppError(
            ERR_SETTINGS_THRESHOLD,
            f"Ngưỡng MUA phải trong khoảng {BUY_THRESHOLD_MIN}–{BUY_THRESHOLD_MAX}",
            http_status=400,
        )
    if not (HOLD_MIN_THRESHOLD_MIN <= hm <= HOLD_MIN_THRESHOLD_MAX):
        raise AppError(
            ERR_SETTINGS_THRESHOLD,
            f"Ngưỡng GIỮ phải trong khoảng {HOLD_MIN_THRESHOLD_MIN}–{HOLD_MIN_THRESHOLD_MAX}",
            http_status=400,
        )
    if bt <= hm:
        raise AppError(
            ERR_SETTINGS_THRESHOLD,
            "Ngưỡng MUA phải lớn hơn ngưỡng GIỮ",
            http_status=400,
        )

    # Telegram cross-field
    if merged["telegram_enabled"]:
        if not str(merged["telegram_chat_id"] or "").strip():
            raise AppError(
                ERR_SETTINGS_TELEGRAM_EMPTY,
                "Bật Telegram cần điền chat_id",
                http_status=400,
            )
        if not str(merged["telegram_token"] or "").strip():
            raise AppError(
                ERR_SETTINGS_TELEGRAM_EMPTY,
                "Bật Telegram cần điền bot token",
                http_status=400,
            )

    # telegram_top_n enum
    if int(merged["telegram_top_n"]) not in TELEGRAM_TOP_N_OPTIONS:
        raise AppError(
            ERR_SETTINGS_TOP_N,
            f"Top N của Telegram phải là {TELEGRAM_TOP_N_OPTIONS[0]} hoặc {TELEGRAM_TOP_N_OPTIONS[1]}",
            http_status=400,
        )

    # Enum membership
    if merged["theme"] not in {t.value for t in Theme}:
        raise AppError(ERR_SETTINGS_THEME, "Theme không hợp lệ", http_status=400)
    if merged["classic_mode"] not in {m.value for m in ClassicMode}:
        raise AppError(ERR_SETTINGS_CLASSIC_MODE, "classic_mode không hợp lệ", http_status=400)
    if merged["language"] not in {lang.value for lang in Language}:
        raise AppError(ERR_SETTINGS_LANGUAGE, "language không hợp lệ", http_status=400)


def apply_patch(db: Session, patch_in: dict) -> SettingsRow:
    """Validate effective state → apply non-None fields → bump version."""
    current = settings_repo.get_settings_row(db)
    validate_patch(current, patch_in)
    non_null = {k: v for k, v in patch_in.items() if v is not None}
    return settings_repo.apply_patch(db, non_null)
