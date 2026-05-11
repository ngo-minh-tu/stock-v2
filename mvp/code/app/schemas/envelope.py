"""Response envelope — TAD g02 §6.

Mọi router return phải qua `success(data)` (helpers ở app.core.envelope) hoặc
raise `AppError` (handler tự wrap envelope error).
Schemas dưới chỉ dùng để document OpenAPI shape, không enforce runtime.
"""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ApiSuccess(BaseModel, Generic[T]):
    model_config = ConfigDict(extra="forbid")

    success: bool = True
    data: T


class ApiErrorPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    detail: str | None = None


class ApiError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool = False
    error: ApiErrorPayload
