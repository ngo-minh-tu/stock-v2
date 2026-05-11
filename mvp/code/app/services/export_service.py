"""Export PDF service — TAD c06 §1 + SRS f13 UC-13-01.

Dual-mode controlled by `EXPORT_PDF_MODE` env var:
- `weasyprint` (default): render HTML → PDF binary via WeasyPrint
- `html_mock`: serve HTML string với `Content-Type: application/pdf` (TAD c06 §1.2 prototype)

Frontend KHÔNG đổi giữa 2 mode (download flow same — Content-Disposition attachment).
Failure trong WeasyPrint render (e.g. font missing) → fallback `html_mock`.

Pages: Cover + Market Overview + Top 10 MUA + Top 20 Red Flags + Disclaimer.
NO chart images (TAD c06 §1.1) — text/table only per PRD §3.5 MVP scope.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from html import escape as h
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_settings
from app.constants.error_codes import ERR_EXPORT_NO_DATA, ERR_NOT_FOUND
from app.core.errors import AppError
from app.repositories import excluded_repo, results_repo, screening_repo
from app.services import dashboard_service
from app.services.results_service import _to_ngan_dong, to_result_row

log = logging.getLogger(__name__)


def _build_html(*, run, summary: dict, top_mua: list[dict], excluded: list[dict]) -> str:
    """HTML template — inline CSS, no external assets, deterministic palette."""
    ts = datetime.now(UTC).strftime("%d/%m/%Y %H:%M UTC")
    rows_top = "".join(
        f"<tr>"
        f"<td>{h(r['ticker'])}</td>"
        f"<td>{h(r.get('name') or '')}</td>"
        f"<td class='num'>{r['ai_score']:.1f}</td>"
        f"<td class='num'>{r.get('confidence', 0):.0f}%</td>"
        f"<td class='num'>{r.get('current_price', 0):.2f}</td>"
        f"<td class='num'>{r.get('target_price_3m', 0):.2f}</td>"
        f"<td class='num'>{r.get('upside_pct', 0):+.1f}%</td>"
        f"<td class='num'>{r.get('stop_loss_price', 0):.2f}</td>"
        f"<td class='num'>{(r.get('allocation_amount') or 0):,.0f}</td>"
        f"</tr>"
        for r in top_mua[:10]
    )
    rows_excl = "".join(
        f"<tr>"
        f"<td>{h(r['ticker'])}</td>"
        f"<td>{h(r['name'])}</td>"
        f"<td class='num'>R{r['excluded_round']}</td>"
        f"<td>{h(r.get('reason_code') or '')}</td>"
        f"<td>{h(r.get('reason') or '')}</td>"
        f"</tr>"
        for r in excluded[:20]
    )

    return f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<title>Báo cáo {h(run.run_id)}</title>
<style>
  @page {{ size: A4; margin: 18mm 14mm; }}
  body {{ font-family: 'Inter', 'Helvetica', sans-serif; color: #1a1d23; font-size: 10pt; }}
  h1 {{ font-size: 22pt; margin: 0 0 4pt; color: #0a4275; }}
  h2 {{ font-size: 14pt; margin: 14pt 0 6pt; color: #0a4275; border-bottom: 1pt solid #cbd5e1; padding-bottom: 2pt; }}
  .meta {{ color: #475569; font-size: 9pt; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 6pt; }}
  th, td {{ padding: 4pt 6pt; border-bottom: 0.5pt solid #cbd5e1; text-align: left; font-size: 9pt; }}
  th {{ background: #eff6ff; color: #0a4275; font-weight: 600; }}
  td.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  .kpi-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 6pt; margin-top: 8pt; }}
  .kpi {{ border: 0.5pt solid #cbd5e1; border-radius: 3pt; padding: 6pt 8pt; }}
  .kpi-label {{ color: #475569; font-size: 8pt; text-transform: uppercase; }}
  .kpi-value {{ font-size: 14pt; font-weight: 600; color: #0a4275; }}
  .disclaimer {{ font-size: 8pt; color: #64748b; margin-top: 14pt; line-height: 1.5; }}
  .footer {{ font-size: 8pt; color: #94a3b8; margin-top: 8pt; text-align: center; }}
  .pagebreak {{ page-break-before: always; }}
</style></head><body>

<h1>VN RE AI Screener</h1>
<div class="meta">
  Run ID: <strong>{h(run.run_id)}</strong> ·
  Run at: {run.run_at.isoformat() if run.run_at else '—'} ·
  Model: {h(run.model_version)} · Settings v{int(run.settings_version)}
</div>

<h2>Tổng quan thị trường</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Scored</div><div class="kpi-value">{summary.get('total_scored', 0)}</div></div>
  <div class="kpi"><div class="kpi-label">MUA</div><div class="kpi-value">{summary.get('total_buy', 0)}</div></div>
  <div class="kpi"><div class="kpi-label">GIỮ</div><div class="kpi-value">{summary.get('total_hold', 0)}</div></div>
  <div class="kpi"><div class="kpi-label">BÁN</div><div class="kpi-value">{summary.get('total_sell', 0)}</div></div>
</div>

<h2>Top 10 mã MUA</h2>
<table>
  <thead><tr>
    <th>Mã</th><th>Tên</th><th class='num'>AI Score</th><th class='num'>Conf</th>
    <th class='num'>Giá hiện tại</th><th class='num'>Target 3M</th><th class='num'>Upside</th>
    <th class='num'>Stop loss</th><th class='num'>Phân bổ (đồng)</th>
  </tr></thead>
  <tbody>{rows_top or '<tr><td colspan="9">Không có mã MUA</td></tr>'}</tbody>
</table>

<div class="pagebreak"></div>
<h2>Red Flags — 20 mã bị loại</h2>
<table>
  <thead><tr><th>Mã</th><th>Tên</th><th>Round</th><th>Code</th><th>Lý do</th></tr></thead>
  <tbody>{rows_excl or '<tr><td colspan="5">Không có mã loại</td></tr>'}</tbody>
</table>

<div class="disclaimer">
  <strong>Tuyên bố miễn trừ:</strong> Báo cáo này là sản phẩm tham khảo, KHÔNG phải khuyến nghị
  đầu tư. Mọi quyết định mua/bán cổ phiếu là trách nhiệm của nhà đầu tư. VN RE AI Screener
  không chịu trách nhiệm về tổn thất phát sinh từ việc sử dụng thông tin trong báo cáo.
</div>
<div class="footer">Generated {ts}</div>

</body></html>"""


def _summary_from_run(run) -> dict[str, Any]:
    return {
        "total_scored": int(run.scored_count or 0),
        "total_buy": int(run.buy_count or 0),
        "total_hold": int(run.hold_count or 0),
        "total_sell": int(run.sell_count or 0),
    }


def _top_mua_rows(db: Session, run_id: str) -> list[dict]:
    """Top 10 MUA sort score DESC. Reuse Phase 6 unit conversion (raw VND → ngàn đồng)."""
    rows = results_repo.list_by_run(db, run_id)
    from app.models import Stock

    stocks = {s.ticker: s for s in db.query(Stock).all()}
    mua = [r for r in rows if (r.recommendation or "").upper() == "MUA"]
    mua.sort(key=lambda r: float(r.ai_score or 0.0), reverse=True)
    items: list[dict] = []
    for r in mua[:10]:
        s = stocks.get(r.ticker)
        items.append(
            {
                "ticker": r.ticker,
                "name": s.name if s else r.ticker,
                "ai_score": float(r.ai_score or 0.0),
                "confidence": float(r.confidence or 0.0),
                "current_price": _to_ngan_dong(float(r.current_price or 0.0)),
                "target_price_3m": _to_ngan_dong(float(r.target_price_3m or 0.0)),
                "upside_pct": float(r.upside_pct or 0.0),
                "stop_loss_price": _to_ngan_dong(float(r.stop_loss_price or 0.0)),
                "allocation_amount": float(r.allocation_amount or 0.0),
            }
        )
    return items


def _excluded_rows(db: Session, run_id: str) -> list[dict]:
    rows = excluded_repo.list_by_run(db, run_id)
    from app.models import Stock

    stocks = {s.ticker: s for s in db.query(Stock).all()}
    return [
        {
            "ticker": r.ticker,
            "name": stocks[r.ticker].name if r.ticker in stocks else r.ticker,
            "excluded_round": int(r.excluded_round),
            "reason_code": r.reason_code,
            "reason": r.reason,
        }
        for r in rows
    ]


def render_pdf(db: Session, run_id: str) -> tuple[bytes, str]:
    """Return (body_bytes, content_type). content_type always `application/pdf`
    (TAD c06 §1.2 prototype + production both serve as PDF — frontend stable)."""
    run = screening_repo.get(db, run_id)
    if run is None:
        raise AppError(ERR_NOT_FOUND, "Run không tồn tại", http_status=404)
    if int(run.scored_count or 0) == 0:
        raise AppError(
            ERR_EXPORT_NO_DATA,
            "Run chưa có dữ liệu để export",
            http_status=400,
        )

    summary = _summary_from_run(run)
    top_mua = _top_mua_rows(db, run_id)
    excluded = _excluded_rows(db, run_id)
    html = _build_html(run=run, summary=summary, top_mua=top_mua, excluded=excluded)

    mode = (get_settings().export_pdf_mode or "weasyprint").lower()
    if mode == "weasyprint":
        try:
            from weasyprint import HTML  # noqa: PLC0415 — lazy import (heavy)

            pdf_bytes = HTML(string=html).write_pdf()
            return pdf_bytes, "application/pdf"
        except Exception as exc:  # noqa: BLE001
            # Fallback to HTML mock if WeasyPrint fails (font missing, libpango error...)
            log.warning("weasyprint render failed (%s) — falling back to html_mock", exc)
    # html_mock fallback / explicit mode
    return html.encode("utf-8"), "application/pdf"


# Re-export for dashboard cross-use (cluster 6 share-data needs same summary)
def build_share_data(db: Session, run) -> dict:
    """Build share view data — summary + dashboard + top_mua. TAD g02 §9.2.

    `top_mua`: full `ScreeningResult` shape filter rec=MUA top 10 (sort score DESC).
    Reuse Phase 6 `to_result_row` so SharedView TopMuaTable consumer renders identical
    to the authenticated Top MUA page.
    """
    from app.models import Stock

    rows = results_repo.list_by_run(db, run.run_id)
    stocks = {s.ticker: s for s in db.query(Stock).all()}
    mua_full = [
        to_result_row(r, stocks.get(r.ticker))
        for r in rows
        if (r.recommendation or "").upper() == "MUA"
    ]
    mua_full.sort(key=lambda r: float(r.get("ai_score") or 0.0), reverse=True)
    return {
        "summary": _summary_from_run(run),
        "dashboard": dashboard_service.build_dashboard(db, run),
        "top_mua": mua_full[:10],
    }
