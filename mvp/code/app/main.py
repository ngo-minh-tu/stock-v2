from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router as api_router
from app.config import get_settings
from app.core.errors import register_exception_handlers

# Phase 28 (Phase 22 REVIEW Low carry) — extensible set cho production guard.
# Mỗi entry là LOCAL-only secret file gitignored — KHÔNG được bundle vào container
# production. Future secrets (vd `.env.slack`, `.env.aws`) thêm vào set này, KHÔNG
# cần edit `_enforce_production_secret_isolation()` logic.
_PRODUCTION_FORBIDDEN_FILES: frozenset[str] = frozenset(
    {
        ".env.telegram",   # Phase 20 — Telegram bot creds local-only
    }
)


def _enforce_production_secret_isolation() -> None:
    """Phase 22+28 — fail fast nếu `APP_ENV=production` + bất kỳ local-only secret
    file nào trong `_PRODUCTION_FORBIDDEN_FILES` tồn tại.

    Local-only secret files đều gitignored. Production phải inject secrets qua
    container `--env-file` từ secret manager — KHÔNG bundle vào image. Misconfig
    deploy phát hiện ngay startup, trước first request.
    """
    settings = get_settings()
    if settings.app_env != "production":
        return
    leaked = [name for name in _PRODUCTION_FORBIDDEN_FILES if Path(name).exists()]
    if leaked:
        files_list = ", ".join(sorted(leaked))
        raise RuntimeError(
            f"Local-only secret files detected in production environment: {files_list}. "
            "Must NOT be deployed. Inject secrets via env vars from a secret manager."
        )


def create_app() -> FastAPI:
    settings = get_settings()
    _enforce_production_secret_isolation()
    app = FastAPI(
        title="VN RE AI Screener — MVP",
        version=settings.app_version,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
