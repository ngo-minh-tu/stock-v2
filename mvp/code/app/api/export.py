"""Export PDF endpoint — TAD g02 §9.1 + SRS f13 UC-13-01.

GET /api/export/pdf/{run_id} → 200 application/pdf + Content-Disposition attachment.
Body = WeasyPrint binary (default) hoặc HTML string (fallback / html_mock mode).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path
from fastapi.responses import Response

from app.dependencies import CurrentUser, DbSession
from app.services import export_service

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/pdf/{run_id}")
def export_pdf(
    db: DbSession,
    _user: CurrentUser,
    run_id: Annotated[str, Path(min_length=1)],
) -> Response:
    body, content_type = export_service.render_pdf(db, run_id)
    return Response(
        content=body,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="run-{run_id}.pdf"'},
    )
