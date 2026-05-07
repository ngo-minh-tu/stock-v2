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

export function buildPdfHtml(input: PdfBuildInput): string {
  const { summary, results, excluded, brand, tagline } = input;
  const top10Mua = results
    .filter((r) => r.recommendation === 'MUA')
    .sort((a, b) => b.ai_score - a.ai_score)
    .slice(0, 10);
  const redFlags = excluded.slice(0, 20);

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

  const excludedRows = redFlags
    .map(
      (r) => `
      <tr>
        <td><strong>${r.ticker}</strong></td>
        <td>${r.name}</td>
        <td>Vòng ${r.excluded_round}</td>
        <td>${r.reason_code}</td>
        <td>${r.reason_text}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>VN RE AI Screener — Run ${summary.run_id}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif; color: #1e2329; padding: 32px; max-width: 920px; margin: 0 auto; line-height: 1.45; }
  h1 { color: #d32f2f; margin: 0; font-size: 22px; }
  h2 { font-size: 15px; margin: 24px 0 8px; color: #2b3139; border-bottom: 1px solid #d8d8d8; padding-bottom: 4px; }
  .tagline { color: #707a8a; font-size: 11px; }
  .meta { color: #1e2329; font-size: 12px; margin-top: 6px; }
  .meta span { margin-right: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th { background: #f1f3f6; text-align: left; padding: 6px 8px; border-bottom: 1px solid #d8d8d8; }
  td { padding: 6px 8px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
  .kpi { border: 1px solid #d8d8d8; padding: 8px 10px; border-radius: 4px; }
  .kpi .label { color: #707a8a; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  .kpi .value { font-size: 20px; font-weight: 700; }
  .kpi.buy .value { color: #14a76c; }
  .kpi.hold .value { color: #f0b90b; }
  .kpi.sell .value { color: #d32f2f; }
  .disclaimer { margin-top: 32px; padding: 12px; background: #fffbe6; border-left: 3px solid #f0b90b; font-size: 11px; color: #1e2329; }
  .footer { margin-top: 16px; color: #707a8a; font-size: 10px; }
</style>
</head>
<body>
  <header>
    <h1>${brand}</h1>
    <div class="tagline">${tagline}</div>
    <div class="meta">
      <span><strong>Run:</strong> ${summary.run_id}</span>
      <span><strong>Thời gian:</strong> ${fmtDate(summary.run_at)}</span>
      <span><strong>Model:</strong> ${summary.model_version}</span>
      <span><strong>Settings:</strong> v${summary.settings_version}</span>
    </div>
  </header>

  <h2>Tổng quan</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="label">Tổng mã chấm</div><div class="value">${summary.scored_count}</div></div>
    <div class="kpi buy"><div class="label">MUA</div><div class="value">${summary.buy_count}</div></div>
    <div class="kpi hold"><div class="label">GIỮ</div><div class="value">${summary.hold_count}</div></div>
    <div class="kpi sell"><div class="label">BÁN</div><div class="value">${summary.sell_count}</div></div>
  </div>
  <p class="meta">
    AI Score TB: <strong>${summary.avg_score.toFixed(1)}</strong>
    · Tổng vốn phân bổ: <strong>${fmtVnd(summary.total_capital)} VND</strong>
    · Thời lượng: <strong>${summary.duration_seconds}s</strong>
    · Cảnh báo: <strong>${summary.warnings_count}</strong>
  </p>

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

  <h2>Mã rủi ro / loại trừ (top ${redFlags.length})</h2>
  ${
    redFlags.length === 0
      ? '<p class="meta">Không có mã bị loại.</p>'
      : `<table>
          <thead>
            <tr><th>Mã</th><th>Tên</th><th>Vòng</th><th>Reason code</th><th>Chi tiết</th></tr>
          </thead>
          <tbody>${excludedRows}</tbody>
        </table>`
  }

  <div class="disclaimer">
    <strong>Disclaimer:</strong> Công cụ chỉ hỗ trợ phân tích, KHÔNG phải khuyến nghị đầu tư chính thức.
    Mọi quyết định là trách nhiệm của người dùng. Dữ liệu mock — chỉ dùng để test UX prototype.
  </div>

  <div class="footer">
    Generated ${fmtDate(new Date().toISOString())} · ${REC_LABEL.MUA}/${REC_LABEL.GIU}/${REC_LABEL.BAN} canonical labels
  </div>
</body>
</html>`;
}
