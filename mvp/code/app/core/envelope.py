from typing import Any


def success(data: Any) -> dict[str, Any]:
    return {"success": True, "data": data}


def error(code: str, message: str, detail: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"code": code, "message": message}
    if detail is not None:
        payload["detail"] = detail
    return {"success": False, "error": payload}
