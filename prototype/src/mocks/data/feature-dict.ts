// 38 scoring feature dictionary — sourced from PRD v0.5A Appendix A (locked).
// Format: { id, group, vi, en, direction, format, range }
//
// `direction`: 'high' = higher value is better; 'low' = lower is better; 'none' = neutral.
//   Drives the green/red tint on the breakdown table per AC-08-05.
// `format`: how to render the raw value cell. The normalized 0-100 score lives in `radar`/score
//   payload — these `value`s are the raw underlying numbers (e.g. P/E = 12.5, ROE = 16.8%).

export type FeatureGroup =
  | 'fundamental'
  | 'technical'
  | 'macro'
  | 'realestate'
  | 'sentiment';

export interface FeatureMeta {
  id: string;
  group: FeatureGroup;
  vi: string;
  en: string;
  direction: 'high' | 'low' | 'none';
  format: 'number' | 'percent' | 'currencyB' | 'ratio' | 'score' | 'sentiment';
  // Indicative raw-value range — used by the mock to synthesize realistic numbers.
  range: [number, number];
}

export const FEATURE_DICT: FeatureMeta[] = [
  // Group 1 — Fundamental (16) ------------------------------------------------
  { id: 'F01', group: 'fundamental', vi: 'P/E', en: 'P/E', direction: 'low', format: 'number', range: [6, 25] },
  { id: 'F02', group: 'fundamental', vi: 'P/B', en: 'P/B', direction: 'low', format: 'number', range: [0.6, 3.5] },
  { id: 'F03', group: 'fundamental', vi: 'ROE', en: 'ROE', direction: 'high', format: 'percent', range: [3, 25] },
  { id: 'F04', group: 'fundamental', vi: 'ROA', en: 'ROA', direction: 'high', format: 'percent', range: [1, 12] },
  { id: 'F05', group: 'fundamental', vi: 'EPS', en: 'EPS', direction: 'high', format: 'currencyB', range: [0.5, 8] },
  { id: 'F06', group: 'fundamental', vi: 'D/E', en: 'D/E', direction: 'low', format: 'number', range: [0.3, 3.2] },
  { id: 'F07', group: 'fundamental', vi: 'Biên LN ròng', en: 'Net margin', direction: 'high', format: 'percent', range: [3, 28] },
  { id: 'F08', group: 'fundamental', vi: 'Tăng trưởng DT YoY', en: 'Revenue growth YoY', direction: 'high', format: 'percent', range: [-10, 35] },
  { id: 'F09', group: 'fundamental', vi: 'Tăng trưởng LN YoY', en: 'Profit growth YoY', direction: 'high', format: 'percent', range: [-15, 40] },
  { id: 'F10', group: 'fundamental', vi: 'OCF', en: 'OCF', direction: 'high', format: 'currencyB', range: [-50, 800] },
  { id: 'F11', group: 'fundamental', vi: 'Current Ratio', en: 'Current Ratio', direction: 'high', format: 'number', range: [0.8, 3] },
  { id: 'F12', group: 'fundamental', vi: 'Tiền ứng trước KH', en: 'Customer advances', direction: 'high', format: 'currencyB', range: [50, 1500] },
  { id: 'F13', group: 'fundamental', vi: 'OCF / Net Income', en: 'OCF / Net Income', direction: 'high', format: 'ratio', range: [-0.2, 2] },
  { id: 'F14', group: 'fundamental', vi: 'Tồn kho / TS', en: 'Inventory / Assets', direction: 'low', format: 'percent', range: [15, 70] },
  { id: 'F15', group: 'fundamental', vi: 'Vòng quay tồn kho', en: 'Inventory turnover', direction: 'high', format: 'number', range: [0.2, 1.5] },
  { id: 'F16', group: 'fundamental', vi: 'Inv vs Rev growth', en: 'Inv growth vs Rev growth', direction: 'low', format: 'ratio', range: [-1, 1.5] },

  // Group 2 — Technical (9) ---------------------------------------------------
  { id: 'T01', group: 'technical', vi: 'MA Trend Score', en: 'MA Trend Score', direction: 'high', format: 'score', range: [0, 100] },
  { id: 'T02', group: 'technical', vi: 'EMA Momentum', en: 'EMA Momentum', direction: 'high', format: 'score', range: [0, 100] },
  { id: 'T03', group: 'technical', vi: 'RSI(14)', en: 'RSI(14)', direction: 'none', format: 'number', range: [25, 80] },
  { id: 'T04', group: 'technical', vi: 'MACD Histogram', en: 'MACD Histogram', direction: 'high', format: 'number', range: [-1.2, 1.5] },
  { id: 'T05', group: 'technical', vi: 'Vị trí Bollinger', en: 'Bollinger Position', direction: 'none', format: 'ratio', range: [0, 1] },
  { id: 'T06', group: 'technical', vi: 'KLGD TB 20D', en: 'Avg Volume 20D', direction: 'high', format: 'currencyB', range: [200, 5000] },
  { id: 'T07', group: 'technical', vi: 'Price Return 1M', en: 'Price Return 1M', direction: 'high', format: 'percent', range: [-15, 20] },
  { id: 'T08', group: 'technical', vi: 'Price Return 3M', en: 'Price Return 3M', direction: 'high', format: 'percent', range: [-25, 35] },
  { id: 'T09', group: 'technical', vi: 'Price Return 6M', en: 'Price Return 6M', direction: 'high', format: 'percent', range: [-30, 50] },

  // Group 3 — Macro (5) -------------------------------------------------------
  { id: 'M01', group: 'macro', vi: 'Lãi suất NHNN', en: 'SBV policy rate', direction: 'low', format: 'percent', range: [3, 7] },
  { id: 'M02', group: 'macro', vi: 'Tăng trưởng tín dụng BĐS', en: 'RE credit growth', direction: 'high', format: 'percent', range: [4, 16] },
  { id: 'M03', group: 'macro', vi: 'CPI', en: 'CPI', direction: 'low', format: 'percent', range: [2, 6] },
  { id: 'M04', group: 'macro', vi: 'FDI vào BĐS', en: 'RE FDI', direction: 'high', format: 'currencyB', range: [400, 3500] },
  { id: 'M05', group: 'macro', vi: 'VN-Index', en: 'VN-Index', direction: 'high', format: 'number', range: [1100, 1400] },

  // Group 4 — Real estate (5) -------------------------------------------------
  { id: 'R01', group: 'realestate', vi: 'Quỹ đất (ha)', en: 'Land bank (ha)', direction: 'high', format: 'number', range: [50, 800] },
  { id: 'R02', group: 'realestate', vi: 'Số dự án triển khai', en: 'Active projects', direction: 'high', format: 'number', range: [3, 25] },
  { id: 'R03', group: 'realestate', vi: 'NAV / cổ phiếu', en: 'NAV per share', direction: 'high', format: 'number', range: [10, 80] },
  { id: 'R04', group: 'realestate', vi: 'Chiết khấu NAV', en: 'NAV discount', direction: 'high', format: 'percent', range: [-10, 35] },
  { id: 'R05', group: 'realestate', vi: 'Legal Risk Score', en: 'Legal Risk Score', direction: 'low', format: 'score', range: [1, 5] },

  // Group 5 — Sentiment (3) ---------------------------------------------------
  { id: 'S01', group: 'sentiment', vi: 'Sentiment score', en: 'Sentiment score', direction: 'high', format: 'sentiment', range: [-1, 1] },
  { id: 'S02', group: 'sentiment', vi: 'Số tin 30 ngày', en: 'News count 30d', direction: 'high', format: 'number', range: [0, 60] },
  { id: 'S03', group: 'sentiment', vi: 'Giao dịch nội bộ', en: 'Insider net (cp)', direction: 'high', format: 'number', range: [-500_000, 500_000] },
];

if (FEATURE_DICT.length !== 38) {
  // eslint-disable-next-line no-console
  console.warn(`[feature-dict] expected 38, got ${FEATURE_DICT.length}`);
}

export const FEATURE_BY_ID: Record<string, FeatureMeta> = Object.fromEntries(
  FEATURE_DICT.map((f) => [f.id, f]),
);

export const FEATURE_GROUPS: FeatureGroup[] = [
  'fundamental',
  'technical',
  'macro',
  'realestate',
  'sentiment',
];

// Format a raw value into a displayable string.
export function formatFeatureValue(meta: FeatureMeta, value: number): string {
  switch (meta.format) {
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'currencyB':
      return `${value.toFixed(0)} tỷ`;
    case 'ratio':
      return value.toFixed(2);
    case 'score':
      return value.toFixed(0);
    case 'sentiment':
      return value.toFixed(2);
    case 'number':
    default:
      // Heuristic: small numbers → 2 decimals, big ints → integer.
      return Math.abs(value) < 10 ? value.toFixed(2) : value.toLocaleString('fr-FR');
  }
}

// Per AC-08-05: green if "good direction", red if "bad". Uses the meta direction.
export function featureDirectionTone(
  meta: FeatureMeta,
  value: number,
): 'good' | 'bad' | 'neutral' {
  if (meta.direction === 'none') return 'neutral';
  // Mid-point of indicative range as the "neutral" pivot.
  const mid = (meta.range[0] + meta.range[1]) / 2;
  const aboveMid = value > mid;
  if (meta.direction === 'high') return aboveMid ? 'good' : 'bad';
  return aboveMid ? 'bad' : 'good';
}
