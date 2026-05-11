"""Settings endpoints — GET /settings, PUT /settings."""

from fastapi import APIRouter

from app.core.envelope import success
from app.dependencies import CurrentUser, DbSession
from app.schemas.settings import SettingsPatch, SettingsResponse
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def get_settings(db: DbSession, _user: CurrentUser) -> dict:
    row = settings_service.get_current(db)
    return success(SettingsResponse.model_validate(row).model_dump(mode="json"))


@router.put("")
def update_settings(patch: SettingsPatch, db: DbSession, _user: CurrentUser) -> dict:
    row = settings_service.apply_patch(db, patch.model_dump(exclude_unset=False))
    db.commit()
    return success(SettingsResponse.model_validate(row).model_dump(mode="json"))
