"""Auth request/response schemas — SRS f16 + TAD g02 §9.5."""

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    """Single-user MVP — chỉ password (no username/email)."""

    model_config = ConfigDict(extra="forbid")

    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    token: str


class PasswordChangeRequest(BaseModel):
    """`new` là Python keyword → alias mapping."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    current: str = Field(min_length=1)
    new_password: str = Field(min_length=1, alias="new")


class PasswordChangeResponse(BaseModel):
    """Trả token mới sau đổi password — SRS f15 UC-15-06 + TAD g02 §9.5.

    Frontend `localStorage.setItem('token', resp.token)` dùng tự động cho request kế.
    """

    token: str
