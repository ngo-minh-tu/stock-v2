"""Settings repository — single row id=1, version bump on update."""

from sqlalchemy.orm import Session

from app.models import Settings as SettingsRow

SETTINGS_ID = 1


def get_settings_row(db: Session) -> SettingsRow:
    row = db.get(SettingsRow, SETTINGS_ID)
    if row is None:
        raise RuntimeError("Settings row chưa được seed; chạy app.db.seed trước")
    return row


def apply_patch(db: Session, patch: dict) -> SettingsRow:
    """Apply patch fields, bump `version`, flush. Caller phải validate trước."""
    row = get_settings_row(db)
    for key, value in patch.items():
        setattr(row, key, value)
    row.version = row.version + 1
    db.flush()
    db.refresh(row)
    return row
