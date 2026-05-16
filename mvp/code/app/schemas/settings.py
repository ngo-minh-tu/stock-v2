"""Settings request/response schemas — SRS f15 UC-15-01."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SettingsResponse(BaseModel):
    """GET /settings — full state. password_hash KHÔNG include (security).

    Field `settings_version` đọc từ ORM column `version` (DB-side giữ tên gọn,
    response/FE dùng `settings_version` đồng bộ với RunSummary.settings_version).
    """

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    settings_version: int = Field(alias="version")

    buy_threshold: int
    hold_min_threshold: int
    default_capital: float

    source_cafef: bool
    source_vnexpress: bool
    source_vietstock: bool
    source_batdongsan: bool
    source_thanhnien: bool

    telegram_enabled: bool
    telegram_chat_id: str
    telegram_token: str
    telegram_top_n: int

    theme: str
    classic_mode: str
    language: str

    updated_at: datetime


class SettingsPatch(BaseModel):
    """PUT /settings — partial patch. Mọi field optional.

    Cross-field validation đẩy sang services/settings_service.validate_patch
    (effective-state pattern UC-15-07). Pydantic schema chỉ enforce per-field type/range.
    """

    model_config = ConfigDict(extra="forbid")

    buy_threshold: int | None = None
    hold_min_threshold: int | None = None
    default_capital: float | None = None

    source_cafef: bool | None = None
    source_vnexpress: bool | None = None
    source_vietstock: bool | None = None
    source_batdongsan: bool | None = None
    source_thanhnien: bool | None = None

    telegram_enabled: bool | None = None
    telegram_chat_id: str | None = None
    telegram_token: str | None = None
    telegram_top_n: int | None = None

    theme: str | None = None
    classic_mode: str | None = None
    language: str | None = None
