from fastapi import APIRouter

from app.config import get_settings
from app.core.envelope import success

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    return success({"status": "ok", "active_job": None})


@router.get("/version")
async def version() -> dict:
    settings = get_settings()
    return success({
        "app_version": settings.app_version,
        "prd_version": "v0.5A",
        "srs_version": "v1.4",
        "tad_version": "v1.5",
        "model_version": "baseline_v2",
        "db_tables": 16,
    })
