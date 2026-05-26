"""Export PDF service — TAD c06 §1 + SRS f13 UC-13-01.

Dual-mode controlled by `EXPORT_PDF_MODE` env var:
- `weasyprint` (default): render HTML → PDF binary via WeasyPrint
- `html_mock`: serve HTML string với `Content-Type: application/pdf` (TAD c06 §1.2 prototype)

Frontend KHÔNG đổi giữa 2 mode (download flow same — Content-Disposition attachment).
Failure trong WeasyPrint render (e.g. font missing) → fallback `html_mock`.

Pages: Cover + Market Overview + Top 10 MUA + selected scored universe + reader guide + Disclaimer.
NO chart images (TAD c06 §1.1) — text/table only per PRD §3.5 MVP scope.
"""

from __future__ import annotations

import logging
import json
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


def _build_html(*, run, summary: dict, top_mua: list[dict], selected: list[dict]) -> str:
    """HTML template — inline CSS, no external assets, deterministic palette."""
    ts = datetime.now(UTC).strftime("%d/%m/%Y %H:%M UTC")
    run_at = run.run_at.strftime("%d/%m/%Y %H:%M") if run.run_at else "—"
    rows_top = "".join(
        f"<tr>"
        f"<td><strong>{h(r['ticker'])}</strong></td>"
        f"<td>{h(r.get('name') or '')}</td>"
        f"<td class='num'>{r['ai_score']:.1f}</td>"
        f"<td class='num'>{r.get('confidence', 0):.0f}%</td>"
        f"<td class='num'>{r.get('current_price', 0):.2f}</td>"
        f"<td class='num'>{r.get('target_price_3m', 0):.2f}</td>"
        f"<td class='num positive'>{r.get('upside_pct', 0):+.1f}%</td>"
        f"<td class='num'>{r.get('stop_loss_price', 0):.2f}</td>"
        f"<td class='num'>{(r.get('allocation_amount') or 0):,.0f}</td>"
        f"</tr>"
        for r in top_mua[:10]
    )
    rows_selected = "".join(
        f"<tr>"
        f"<td><strong>{h(r['ticker'])}</strong></td>"
        f"<td>{h(r['name'])}</td>"
        f"<td class='num'>{r['ai_score']:.1f}</td>"
        f"<td><span class='rec-pill rec-{h((r.get('recommendation') or '').lower())}'>{h(r.get('recommendation_label') or '')}</span></td>"
        f"<td>{h(r.get('reason') or '')}</td>"
        f"</tr>"
        for r in selected[:17]
    )

    return f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<title>Báo cáo {h(run.run_id)}</title>
<style>
  @page {{ size: A4; margin: 16mm 14mm; }}
  :root {{
    --page-bg: #ffffff;
    --surface: #ffffff;
    --surface-2: #fff5f5;
    --border: #dfe1e6;
    --border-soft: #eceff3;
    --text: #1e2329;
    --muted: #6b7280;
    --crimson: #ed1c24;
    --crimson-dark: #ed1c24;
    --crimson-soft: #fff1f2;
    --buy: #1aa67c;
    --sell: #c9111f;
    --stable: #848e9c;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: Arial, "Helvetica Neue", "DejaVu Sans", sans-serif;
    color: var(--text);
    background: var(--page-bg);
    font-size: 9.5pt;
    line-height: 1.42;
  }}
  .cover-accent {{
    height: 7pt;
    background: var(--crimson);
    margin: -2pt 0 20pt;
  }}
  .brand-row {{
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18pt;
    margin-bottom: 14pt;
  }}
  .brand-copy {{
    max-width: 360pt;
  }}
  .eyebrow {{
    margin-bottom: 4pt;
    color: var(--crimson);
    font-size: 7.5pt;
    font-weight: 800;
    letter-spacing: 0.8pt;
    text-transform: uppercase;
  }}
  h1 {{
    margin: 0;
    font-size: 21pt;
    line-height: 1.12;
    color: var(--crimson);
    letter-spacing: 0;
  }}
  .tagline {{
    margin-top: 5pt;
    color: var(--crimson);
    font-size: 10.5pt;
    font-weight: 700;
    line-height: 1.35;
  }}
  .title-cn {{
    margin-top: 3pt;
    color: var(--crimson);
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.2pt;
  }}
  .run-chip {{
    min-width: 104pt;
    border: 1pt solid var(--crimson);
    border-radius: 4pt;
    padding: 7pt 9pt;
    color: var(--muted);
    font-size: 8.5pt;
    text-align: right;
    background: var(--crimson-soft);
  }}
  .run-chip strong {{
    color: var(--text);
    font-size: 9pt;
  }}
  .meta-grid {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7pt;
    margin: 14pt 0 18pt;
  }}
  .meta-item {{
    border: 0.7pt solid var(--border);
    border-radius: 4pt;
    padding: 6pt 7pt;
    background: #ffffff;
    border-top: 2pt solid var(--crimson);
  }}
  .meta-label {{
    color: var(--crimson-dark);
    font-size: 7.2pt;
    text-transform: uppercase;
    letter-spacing: 0.45pt;
    font-weight: 800;
  }}
  .meta-value {{
    color: var(--text);
    font-size: 8.5pt;
    font-weight: 700;
    overflow-wrap: anywhere;
  }}
  h2 {{
    margin: 5pt 0 8pt;
    padding-bottom: 6pt;
    border-bottom: 1.4pt solid var(--crimson);
    color: var(--crimson);
    font-size: 15.5pt;
    line-height: 1.15;
  }}
  .section-block {{
    margin-top: 17pt;
  }}
  .section-kicker {{
    color: var(--crimson);
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.65pt;
    font-weight: 800;
    margin-bottom: 2pt;
  }}
  .kpi-grid {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6pt;
    margin: 9pt 0 18pt;
  }}
  .kpi {{
    border: 0.7pt solid var(--border-soft);
    border-radius: 4pt;
    padding: 7pt 8pt;
    background: var(--surface);
    border-top: 2.6pt solid var(--crimson);
  }}
  .kpi-label {{
    color: var(--muted);
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.45pt;
    font-weight: 800;
  }}
  .kpi-value {{
    margin-top: 2pt;
    font-size: 18pt;
    line-height: 1;
    font-weight: 800;
    color: var(--crimson-dark);
  }}
  .kpi.buy .kpi-value {{ color: var(--crimson-dark); }}
  .kpi.sell .kpi-value {{ color: var(--sell); }}
  .table-wrap {{
    border: 0.7pt solid var(--border);
    border-radius: 4pt;
    overflow: hidden;
    margin-top: 9pt;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
  }}
  th, td {{
    padding: 5pt 6pt;
    border-bottom: 0.5pt solid var(--border-soft);
    text-align: left;
    font-size: 8.5pt;
    vertical-align: top;
  }}
  th {{
    background: var(--crimson);
    color: #ffffff;
    font-weight: 800;
    white-space: nowrap;
  }}
  tbody tr:nth-child(even) td {{ background: var(--crimson-soft); }}
  tbody tr:last-child td {{ border-bottom: 0; }}
  td.num, th.num {{
    text-align: right;
    font-variant-numeric: tabular-nums;
  }}
  .positive {{ color: var(--buy); font-weight: 700; }}
  .empty-row td {{
    color: var(--muted);
    text-align: center;
    padding: 14pt 8pt;
    background: #ffffff;
  }}
  .round-pill, .code-pill, .rec-pill {{
    display: inline-block;
    border-radius: 999pt;
    padding: 1.5pt 5pt;
    font-size: 7.5pt;
    font-weight: 800;
    white-space: nowrap;
  }}
  .rec-pill {{
    min-width: 24pt;
    text-align: center;
    color: #ffffff;
    background: var(--stable);
  }}
  .rec-mua {{ background: var(--crimson); }}
  .rec-giu {{ background: var(--stable); }}
  .rec-ban {{ background: var(--sell); }}
  .round-pill {{
    color: #ffffff;
    background: var(--crimson);
  }}
  .code-pill {{
    color: var(--sell);
    background: var(--crimson-soft);
    border: 0.5pt solid #efb8b8;
  }}
  .disclaimer {{
    margin-top: 14pt;
    padding: 9pt 10pt;
    border-left: 3pt solid var(--crimson);
    background: var(--crimson-soft);
    color: var(--muted);
    font-size: 8pt;
    line-height: 1.5;
  }}
  .guide-lead {{
    margin: 0 0 10pt;
    color: var(--muted);
    font-size: 9pt;
    line-height: 1.55;
  }}
  .guide-grid {{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8pt;
    margin-top: 10pt;
  }}
  .guide-card {{
    min-height: 72pt;
    border: 0.7pt solid var(--border);
    border-radius: 5pt;
    padding: 8pt 9pt;
    background: #ffffff;
    border-top: 2.4pt solid var(--crimson);
  }}
  .guide-title {{
    color: var(--crimson-dark);
    font-size: 9pt;
    font-weight: 800;
    margin-bottom: 4pt;
  }}
  .guide-copy {{
    color: var(--text);
    font-size: 8.2pt;
    line-height: 1.48;
  }}
  .definition-table th {{
    background: var(--crimson-soft);
    color: var(--crimson-dark);
  }}
  .score-scale {{
    margin-top: 10pt;
    border: 0.7pt solid var(--border);
    border-radius: 5pt;
    overflow: hidden;
  }}
  .scale-row {{
    display: grid;
    grid-template-columns: 68pt 1fr;
    border-bottom: 0.5pt solid var(--border-soft);
  }}
  .scale-row:last-child {{ border-bottom: 0; }}
  .scale-label {{
    padding: 6pt 8pt;
    background: var(--crimson-soft);
    color: var(--crimson-dark);
    font-weight: 800;
    font-size: 8pt;
  }}
  .scale-copy {{
    padding: 6pt 8pt;
    color: var(--text);
    font-size: 8pt;
  }}
  .footer {{
    margin-top: 10pt;
    padding-top: 6pt;
    border-top: 0.7pt solid var(--border);
    color: var(--stable);
    font-size: 7.5pt;
    text-align: center;
  }}
  .pagebreak {{ page-break-before: always; }}
</style></head><body>

<div class="cover-accent"></div>
<div class="brand-row">
  <div class="brand-copy">
    <div class="eyebrow">Personal research report</div>
    <h1>Vietnam Real Estate Equity Screening Report</h1>
    <div class="title-cn">越南房地产股票智能筛选报告</div>
    <div class="tagline">Founder: Ngô Minh Tú — Dữ liệu dẫn đường, quyết định thuộc về bạn!</div>
  </div>
  <div class="run-chip">Generated<br><strong>{ts}</strong></div>
</div>

<div class="meta-grid">
  <div class="meta-item"><div class="meta-label">Run ID</div><div class="meta-value">{h(run.run_id)}</div></div>
  <div class="meta-item"><div class="meta-label">Run at</div><div class="meta-value">{h(run_at)}</div></div>
  <div class="meta-item"><div class="meta-label">Model</div><div class="meta-value">{h(run.model_version)}</div></div>
  <div class="meta-item"><div class="meta-label">Settings</div><div class="meta-value">v{int(run.settings_version)}</div></div>
</div>

<div class="section-block">
  <div class="section-kicker">Market overview</div>
  <h2>Tổng quan thị trường</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Scored</div><div class="kpi-value">{summary.get('total_scored', 0)}</div></div>
    <div class="kpi buy"><div class="kpi-label">MUA</div><div class="kpi-value">{summary.get('total_buy', 0)}</div></div>
    <div class="kpi"><div class="kpi-label">GIỮ</div><div class="kpi-value">{summary.get('total_hold', 0)}</div></div>
    <div class="kpi sell"><div class="kpi-label">BÁN</div><div class="kpi-value">{summary.get('total_sell', 0)}</div></div>
  </div>
</div>

<div class="section-block">
  <div class="section-kicker">Buy candidates</div>
  <h2>Top 10 mã MUA</h2>
  <div class="table-wrap">
  <table>
    <thead><tr>
      <th>Mã</th><th>Tên</th><th class='num'>AI Score</th><th class='num'>Conf</th>
      <th class='num'>Giá hiện tại</th><th class='num'>Target 3M</th><th class='num'>Upside</th>
      <th class='num'>Stop loss</th><th class='num'>Phân bổ (đồng)</th>
    </tr></thead>
    <tbody>{rows_top or '<tr class="empty-row"><td colspan="9">Không có mã MUA trong run này</td></tr>'}</tbody>
  </table>
  </div>
</div>

<div class="pagebreak"></div>
<div class="cover-accent"></div>
<div class="section-kicker">Selected universe</div>
<h2>{len(selected[:17])} mã được chọn</h2>
<div class="table-wrap">
<table>
  <thead><tr><th>Mã</th><th>Tên</th><th class="num">AI Score</th><th>Khuyến nghị</th><th>Lý do</th></tr></thead>
  <tbody>{rows_selected or '<tr class="empty-row"><td colspan="5">Không có mã được chấm trong run này</td></tr>'}</tbody>
</table>
</div>

<div class="disclaimer">
  <strong>Tuyên bố miễn trừ:</strong> Báo cáo này là sản phẩm tham khảo, KHÔNG phải khuyến nghị
  đầu tư. Mọi quyết định mua/bán cổ phiếu là trách nhiệm của nhà đầu tư. Hệ thống sàng lọc
  không chịu trách nhiệm về tổn thất phát sinh từ việc sử dụng thông tin trong báo cáo.
</div>

<div class="pagebreak"></div>
<div class="cover-accent"></div>
<div class="section-kicker">Reader guide</div>
<h2>Hướng dẫn đọc báo cáo</h2>
<p class="guide-lead">
  Trang này giải thích các thuật ngữ và cách đọc kết quả để người nhận báo cáo có thể hiểu logic
  sàng lọc mà không cần biết chi tiết kỹ thuật của dự án.
</p>

<div class="guide-grid">
  <div class="guide-card">
    <div class="guide-title">Mục tiêu báo cáo</div>
    <div class="guide-copy">
      Báo cáo dùng dữ liệu định lượng để sàng lọc cổ phiếu bất động sản Việt Nam, xếp hạng cơ hội
      và trình bày danh sách mã đã được chấm điểm trong run hiện tại.
    </div>
  </div>
  <div class="guide-card">
    <div class="guide-title">AI Score</div>
    <div class="guide-copy">
      Điểm tổng hợp trên thang 0-100. Điểm càng cao nghĩa là hồ sơ dữ liệu hiện tại càng thuận lợi
      so với các tiêu chí đang được mô hình sử dụng.
    </div>
  </div>
  <div class="guide-card">
    <div class="guide-title">Khuyến nghị MUA / GIỮ / BÁN</div>
    <div class="guide-copy">
      Nhãn khuyến nghị được suy ra từ AI Score, độ tin cậy và các ngưỡng rủi ro. Đây là tín hiệu hỗ
      trợ phân tích, không phải lệnh giao dịch.
    </div>
  </div>
  <div class="guide-card">
    <div class="guide-title">Danh sách mã được chọn</div>
    <div class="guide-copy">
      Bảng Selected universe lấy trực tiếp từ dữ liệu chấm điểm thật của run. Mỗi dòng có AI Score,
      khuyến nghị và lý do chính để người đọc hiểu vì sao mã được xếp vào nhóm đó.
    </div>
  </div>
</div>

<div class="section-block">
  <div class="section-kicker">Score interpretation</div>
  <h2>Cách diễn giải thang điểm</h2>
  <div class="score-scale">
    <div class="scale-row"><div class="scale-label">80-100</div><div class="scale-copy">Hồ sơ rất mạnh, cần kiểm tra lại thanh khoản và rủi ro sự kiện trước khi ra quyết định.</div></div>
    <div class="scale-row"><div class="scale-label">60-79</div><div class="scale-copy">Hồ sơ tích cực, phù hợp để đưa vào danh sách theo dõi hoặc phân tích sâu hơn.</div></div>
    <div class="scale-row"><div class="scale-label">40-59</div><div class="scale-copy">Hồ sơ trung tính, cần thêm xác nhận từ dữ liệu giá, tin tức và bối cảnh ngành.</div></div>
    <div class="scale-row"><div class="scale-label">0-39</div><div class="scale-copy">Hồ sơ yếu hoặc thiếu tín hiệu hỗ trợ, cần thận trọng khi sử dụng cho quyết định đầu tư.</div></div>
  </div>
</div>

<div class="section-block">
  <div class="section-kicker">Column definitions</div>
  <h2>Ý nghĩa các cột chính</h2>
  <div class="table-wrap">
  <table class="definition-table">
    <thead><tr><th>Cột</th><th>Ý nghĩa</th></tr></thead>
    <tbody>
      <tr><td><strong>Conf</strong></td><td>Độ tin cậy của kết quả, phản ánh mức đầy đủ và nhất quán của dữ liệu đầu vào.</td></tr>
      <tr><td><strong>Target 3M</strong></td><td>Giá mục tiêu tham khảo trong khoảng 3 tháng theo mô hình hiện tại.</td></tr>
      <tr><td><strong>Upside</strong></td><td>Chênh lệch phần trăm giữa giá mục tiêu và giá hiện tại.</td></tr>
      <tr><td><strong>Stop loss</strong></td><td>Mốc giá tham khảo để kiểm soát rủi ro nếu kịch bản không đi đúng hướng.</td></tr>
      <tr><td><strong>Phân bổ</strong></td><td>Số vốn gợi ý theo quy tắc phân bổ của hệ thống, nếu người dùng có nhập tổng vốn.</td></tr>
    </tbody>
  </table>
  </div>
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


REC_LABELS = {"MUA": "MUA", "GIU": "GIỮ", "BAN": "BÁN"}

ENTRY_REASON_LABELS = {
    "VALUATION_ATTRACTIVE": "Định giá hấp dẫn",
    "BULLISH_TREND": "Xu hướng giá tích cực",
    "NAV_DISCOUNT": "Chiết khấu so với giá trị tài sản",
    "STRONG_FUNDAMENTAL": "Nền tảng cơ bản tốt",
    "MACD_BULLISH_CROSS": "Tín hiệu kỹ thuật MACD tích cực",
    "NEAR_RESISTANCE": "Giá gần vùng kháng cự",
    "NEAR_SUPPORT": "Giá gần vùng hỗ trợ",
    "OVERBOUGHT": "Trạng thái quá mua",
    "OVERSOLD": "Trạng thái quá bán",
    "WEAK_TREND": "Xu hướng chưa đủ mạnh",
    "AWAIT_BREAKOUT": "Cần chờ xác nhận breakout",
    "AWAIT_PULLBACK": "Cần chờ nhịp điều chỉnh",
    "AWAIT_CONFIRMATION": "Cần thêm tín hiệu xác nhận",
    "NEGATIVE_RECOMMENDATION": "Khuyến nghị chưa đủ tích cực",
    "INSUFFICIENT_INDICATORS": "Chỉ báo đầu vào chưa đủ mạnh",
}


def _format_entry_reason(row) -> str:
    code = row.entry_reason_code or ""
    if code:
        labels = [ENTRY_REASON_LABELS.get(part, part.replace("_", " ").title()) for part in code.split("+") if part]
        if labels:
            return "; ".join(labels)

    try:
        reasons = json.loads(row.reasons_json or "[]")
    except (TypeError, ValueError):
        reasons = []
    if isinstance(reasons, list):
        parts: list[str] = []
        for item in reasons[:2]:
            if not isinstance(item, dict):
                continue
            feature_id = str(item.get("feature_id") or "").replace("_", " ")
            direction = str(item.get("direction") or "").lower()
            if feature_id:
                parts.append(f"{feature_id}: {direction or 'signal'}")
        if parts:
            return "; ".join(parts)
    return "Không có lý do chi tiết"


def _selected_rows(db: Session, run_id: str) -> list[dict]:
    """Scored universe for PDF page 2, sorted by AI Score DESC and capped to current selected set."""
    rows = results_repo.list_by_run(db, run_id)
    from app.models import Stock

    stocks = {s.ticker: s for s in db.query(Stock).all()}
    sorted_rows = sorted(rows, key=lambda r: float(r.ai_score or 0.0), reverse=True)
    return [
        {
            "ticker": r.ticker,
            "name": stocks[r.ticker].name if r.ticker in stocks else r.ticker,
            "ai_score": float(r.ai_score or 0.0),
            "recommendation": (r.recommendation or "BAN").upper(),
            "recommendation_label": REC_LABELS.get((r.recommendation or "BAN").upper(), r.recommendation or "BÁN"),
            "reason": _format_entry_reason(r),
        }
        for r in sorted_rows[:17]
    ]


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
    selected = _selected_rows(db, run_id)
    html = _build_html(run=run, summary=summary, top_mua=top_mua, selected=selected)

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
