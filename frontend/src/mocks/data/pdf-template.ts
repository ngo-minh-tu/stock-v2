// Cluster 6 §3 + TAD c06 — PDF MVP is text/table only.
// We generate an HTML doc and serve it as application/pdf so the browser downloads
// it. The PdfPreviewModal renders the same HTML inline (read-only iframe).

import type {
  DashboardResponse,
  ExcludedStock,
  RunSummary,
  ScreeningResult,
} from '@/lib/types';

export interface PdfBuildInput {
  summary: RunSummary;
  dashboard: DashboardResponse;
  results: ScreeningResult[];
  excluded: ExcludedStock[];
  brand: string;
  tagline: string;
}

const REC_LABEL: Record<string, string> = { MUA: 'MUA', GIU: 'GIỮ', BAN: 'BÁN' };

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtVnd(n: number): string {
  return n > 0 ? n.toLocaleString('fr-FR') : '—';
}

function reasonSummary(row: ScreeningResult): string {
  const reasons = row.reasons
    .slice(0, 2)
    .map((reason) => {
      const feature = reason.feature_id.replaceAll('_', ' ');
      return reason.text || feature;
    })
    .join('; ');
  if (reasons) return reasons;
  if (row.recommendation === 'MUA') return 'Điểm số và tín hiệu dữ liệu tích cực';
  if (row.recommendation === 'GIU') return 'Tín hiệu trung tính, cần theo dõi thêm';
  return 'Tín hiệu rủi ro cao hơn mức chấp nhận';
}

export function buildPdfHtml(input: PdfBuildInput): string {
  const { summary, results, brand, tagline } = input;
  const top10Mua = results
    .filter((r) => r.recommendation === 'MUA')
    .sort((a, b) => b.ai_score - a.ai_score)
    .slice(0, 10);
  const selectedRows = [...results].sort((a, b) => b.ai_score - a.ai_score).slice(0, 17);

  const topRows = top10Mua
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${r.ticker}</strong></td>
        <td>${r.name}</td>
        <td class="num">${r.ai_score}</td>
        <td class="num">${r.confidence}</td>
        <td class="num">${r.upside_pct.toFixed(1)}%</td>
        <td class="num">${r.stop_loss_price?.toFixed(2) ?? '—'}</td>
        <td class="num">${fmtVnd(r.allocation_amount ?? 0)}</td>
      </tr>`,
    )
    .join('');

  const selectedResultRows = selectedRows
    .map(
      (r) => `
      <tr>
        <td><strong>${r.ticker}</strong></td>
        <td>${r.name}</td>
        <td class="num">${r.ai_score.toFixed(1)}</td>
        <td><span class="rec-pill rec-${r.recommendation.toLowerCase()}">${REC_LABEL[r.recommendation]}</span></td>
        <td>${reasonSummary(r)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Vietnam Real Estate Equity Screening Report — Run ${summary.run_id}</title>
<style>
  :root { --report-red: #ed1c24; --report-red-dark: #ed1c24; --text: #1e2329; --muted: #6b7280; --border: #dfe1e6; --red-soft: #fff1f2; }
  body { font-family: Arial, "Helvetica Neue", "DejaVu Sans", sans-serif; color: var(--text); background: #fff; padding: 36px; max-width: 920px; margin: 0 auto; line-height: 1.45; }
  .topbar { height: 9px; background: var(--report-red); margin: -36px -36px 30px; }
  .brand-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 28px; margin-bottom: 20px; }
  .brand-copy { max-width: 620px; }
  .eyebrow { color: var(--report-red); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 5px; }
  h1 { color: var(--report-red); margin: 0; font-size: 34px; line-height: 1.12; letter-spacing: 0; }
  h2 { font-size: 24px; margin: 6px 0 12px; color: var(--report-red); border-bottom: 3px solid var(--report-red); padding-bottom: 8px; }
  .tagline { color: var(--report-red); font-size: 16px; margin-top: 8px; font-weight: 700; line-height: 1.35; }
  .title-cn { color: var(--report-red); font-size: 14px; margin-top: 5px; font-weight: 700; letter-spacing: .02em; }
  .generated { min-width: 158px; border: 2px solid var(--report-red); border-radius: 6px; padding: 10px 12px; text-align: right; color: var(--muted); background: var(--red-soft); font-size: 12px; }
  .generated strong { color: var(--text); font-size: 13px; }
  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0 26px; }
  .meta-card { border: 1px solid var(--border); border-top: 4px solid var(--report-red); border-radius: 6px; padding: 10px 12px; background: #fff; }
  .meta-label { color: var(--report-red-dark); font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
  .meta-value { margin-top: 3px; color: var(--text); font-size: 13px; font-weight: 800; overflow-wrap: anywhere; }
  .meta { color: var(--text); font-size: 12px; margin-top: 8px; }
  .section { margin-top: 28px; }
  .section-kicker { color: var(--report-red); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; border: 1px solid var(--border); }
  th { background: var(--report-red); color: #fff; text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--report-red); }
  td { padding: 7px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
  tbody tr:nth-child(even) td { background: var(--red-soft); }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .rec-pill { display: inline-block; min-width: 36px; border-radius: 999px; padding: 2px 8px; color: #fff; background: var(--muted); text-align: center; font-size: 11px; font-weight: 800; }
  .rec-mua { background: var(--report-red); }
  .rec-giu { background: var(--muted); }
  .rec-ban { background: #c9111f; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0 26px; }
  .kpi { border: 1px solid var(--border); border-top: 4px solid var(--report-red); padding: 10px 12px; border-radius: 6px; background: #fff; }
  .kpi .label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; }
  .kpi .value { font-size: 28px; font-weight: 800; color: var(--report-red-dark); line-height: 1.05; margin-top: 4px; }
  .kpi.sell .value { color: #c9111f; }
  .disclaimer { margin-top: 32px; padding: 12px; background: var(--red-soft); border-left: 4px solid var(--report-red); font-size: 11px; color: var(--text); }
  .pagebreak { page-break-before: always; break-before: page; }
  .guide-lead { margin: 0 0 14px; color: var(--muted); font-size: 13px; line-height: 1.55; }
  .guide-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 14px; }
  .guide-card { min-height: 104px; border: 1px solid var(--border); border-top: 4px solid var(--report-red); border-radius: 6px; padding: 12px 14px; background: #fff; }
  .guide-title { color: var(--report-red); font-size: 14px; font-weight: 800; margin-bottom: 6px; }
  .guide-copy { color: var(--text); font-size: 12px; line-height: 1.5; }
  .score-scale { margin-top: 14px; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
  .scale-row { display: grid; grid-template-columns: 96px 1fr; border-bottom: 1px solid var(--border); }
  .scale-row:last-child { border-bottom: 0; }
  .scale-label { padding: 9px 11px; background: var(--red-soft); color: var(--report-red); font-weight: 800; font-size: 12px; }
  .scale-copy { padding: 9px 11px; color: var(--text); font-size: 12px; }
  .definition-table th { background: var(--red-soft); color: var(--report-red); }
  .footer { margin-top: 16px; color: var(--muted); font-size: 10px; border-top: 1px solid var(--border); padding-top: 8px; }
</style>
</head>
<body>
  <div class="topbar"></div>
  <header>
    <div class="brand-row">
      <div class="brand-copy">
        <div class="eyebrow">Personal research report</div>
        <h1>${brand}</h1>
        <div class="title-cn">越南房地产股票智能筛选报告</div>
        <div class="tagline">${tagline}</div>
      </div>
      <div class="generated">Generated<br /><strong>${fmtDate(new Date().toISOString())}</strong></div>
    </div>
    <div class="meta-grid">
      <div class="meta-card"><div class="meta-label">Run ID</div><div class="meta-value">${summary.run_id}</div></div>
      <div class="meta-card"><div class="meta-label">Run at</div><div class="meta-value">${fmtDate(summary.run_at)}</div></div>
      <div class="meta-card"><div class="meta-label">Model</div><div class="meta-value">${summary.model_version}</div></div>
      <div class="meta-card"><div class="meta-label">Settings</div><div class="meta-value">v${summary.settings_version}</div></div>
    </div>
  </header>

  <div class="section">
    <div class="section-kicker">Market overview</div>
    <h2>Tổng quan thị trường</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="label">Tổng mã chấm</div><div class="value">${summary.scored_count}</div></div>
      <div class="kpi buy"><div class="label">MUA</div><div class="value">${summary.buy_count}</div></div>
      <div class="kpi hold"><div class="label">GIỮ</div><div class="value">${summary.hold_count}</div></div>
      <div class="kpi sell"><div class="label">BÁN</div><div class="value">${summary.sell_count}</div></div>
    </div>
  </div>
  <p class="meta">
    AI Score TB: <strong>${summary.avg_score.toFixed(1)}</strong>
    · Tổng vốn phân bổ: <strong>${fmtVnd(summary.total_capital)} VND</strong>
    · Thời lượng: <strong>${summary.duration_seconds}s</strong>
    · Cảnh báo: <strong>${summary.warnings_count}</strong>
  </p>

  <div class="section">
  <div class="section-kicker">Buy candidates</div>
  <h2>Top ${top10Mua.length} mã MUA</h2>
  ${
    top10Mua.length === 0
      ? '<p class="meta">Không có mã MUA trong run này.</p>'
      : `<table>
          <thead>
            <tr>
              <th>#</th><th>Mã</th><th>Tên</th>
              <th class="num">AI Score</th>
              <th class="num">Tin cậy</th>
              <th class="num">Upside</th>
              <th class="num">Stop loss</th>
              <th class="num">Phân bổ (VND)</th>
            </tr>
          </thead>
          <tbody>${topRows}</tbody>
        </table>`
  }
  </div>

  <div class="section">
  <div class="section-kicker">Selected universe</div>
  <h2>${selectedRows.length} mã được chọn</h2>
  <table>
    <thead>
      <tr><th>Mã</th><th>Tên</th><th class="num">AI Score</th><th>Khuyến nghị</th><th>Lý do</th></tr>
    </thead>
    <tbody>${selectedResultRows || '<tr><td colspan="5">Không có mã được chấm trong run này.</td></tr>'}</tbody>
  </table>
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> Công cụ chỉ hỗ trợ phân tích, KHÔNG phải khuyến nghị đầu tư chính thức.
    Mọi quyết định là trách nhiệm của người dùng. Dữ liệu mock — chỉ dùng để test UX prototype.
  </div>

  <div class="pagebreak"></div>
  <div class="topbar"></div>
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
        và chỉ ra các mã bị loại do không đạt điều kiện dữ liệu hoặc rủi ro.
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

  <div class="section">
    <div class="section-kicker">Score interpretation</div>
    <h2>Cách diễn giải thang điểm</h2>
    <div class="score-scale">
      <div class="scale-row"><div class="scale-label">80-100</div><div class="scale-copy">Hồ sơ rất mạnh, cần kiểm tra lại thanh khoản và rủi ro sự kiện trước khi ra quyết định.</div></div>
      <div class="scale-row"><div class="scale-label">60-79</div><div class="scale-copy">Hồ sơ tích cực, phù hợp để đưa vào danh sách theo dõi hoặc phân tích sâu hơn.</div></div>
      <div class="scale-row"><div class="scale-label">40-59</div><div class="scale-copy">Hồ sơ trung tính, cần thêm xác nhận từ dữ liệu giá, tin tức và bối cảnh ngành.</div></div>
      <div class="scale-row"><div class="scale-label">0-39</div><div class="scale-copy">Hồ sơ yếu hoặc thiếu tín hiệu hỗ trợ, cần thận trọng khi sử dụng cho quyết định đầu tư.</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-kicker">Column definitions</div>
    <h2>Ý nghĩa các cột chính</h2>
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

  <div class="footer">
    Generated ${fmtDate(new Date().toISOString())} · ${REC_LABEL.MUA}/${REC_LABEL.GIU}/${REC_LABEL.BAN} canonical labels
  </div>
</body>
</html>`;
}
