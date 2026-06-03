// Fixture: 81 BĐS stocks for screening prototype.
// 26 real VN tickers + 55 MOCK_* fillers; 5 of those are special TAD g06 §22 deterministic anchors.
//
// Pure UI/UX — values are mock and pre-baked. Reasons reference real feature IDs
// (F0x = fundamental, T0x = technical, M0x = macro, R0x = realestate, S0x = sentiment)
// to satisfy GUARD-02 (no LLM-generated text).

import type { Recommendation, EntrySignal, WarningBadge } from '@/lib/constants';

export interface StockSeed {
  ticker: string;
  name: string;
  exchange: 'HOSE' | 'HNX' | 'UPCOM';
  sector: string;
  // Stable seed for deterministic per-ticker random — keeps demo coherent across reloads.
  seed: number;
}

const REAL_TICKERS: { ticker: string; name: string; exchange: 'HOSE' | 'HNX' | 'UPCOM' }[] = [
  { ticker: 'VHM', name: 'Công ty Cổ phần Vinhomes', exchange: 'HOSE' },
  { ticker: 'VIC', name: 'Công ty Cổ phần Tập đoàn Vingroup', exchange: 'HOSE' },
  { ticker: 'NVL', name: 'Công ty Cổ phần Tập đoàn Đầu tư Địa ốc No Va', exchange: 'HOSE' },
  { ticker: 'KDH', name: 'Công ty Cổ phần Đầu tư và Kinh doanh Nhà Khang Điền', exchange: 'HOSE' },
  { ticker: 'NLG', name: 'Công ty Cổ phần Đầu tư Nam Long', exchange: 'HOSE' },
  { ticker: 'DXG', name: 'Công ty Cổ phần Tập đoàn Đất Xanh', exchange: 'HOSE' },
  { ticker: 'PDR', name: 'Công ty Cổ phần Phát triển Bất động sản Phát Đạt', exchange: 'HOSE' },
  { ticker: 'KBC', name: 'Tổng Công ty Phát triển Đô thị Kinh Bắc - CTCP', exchange: 'HOSE' },
  { ticker: 'BCM', name: 'Tổng Công ty Đầu tư và Phát triển Công nghiệp - CTCP', exchange: 'HOSE' },
  { ticker: 'VRE', name: 'Công ty Cổ phần Vincom Retail', exchange: 'HOSE' },
  { ticker: 'HDC', name: 'Công ty Cổ phần Phát triển Nhà Bà Rịa - Vũng Tàu', exchange: 'HOSE' },
  { ticker: 'IJC', name: 'Công ty Cổ phần Phát triển Hạ tầng Kỹ thuật', exchange: 'HOSE' },
  { ticker: 'DIG', name: 'Tổng Công ty Cổ phần Đầu tư Phát triển Xây dựng', exchange: 'HOSE' },
  { ticker: 'CEO', name: 'Công ty Cổ phần Tập đoàn C.E.O', exchange: 'HNX' },
  { ticker: 'HQC', name: 'Công ty Cổ phần Tư vấn - Thương mại - Dịch vụ Địa ốc Hoàng Quân', exchange: 'HOSE' },
  { ticker: 'TIG', name: 'Công ty Cổ phần Tập đoàn Đầu tư Thăng Long', exchange: 'HNX' },
  { ticker: 'LDG', name: 'Công ty Cổ phần Đầu tư LDG', exchange: 'HOSE' },
  { ticker: 'ITC', name: 'Công ty Cổ phần Đầu tư - Kinh doanh Nhà', exchange: 'HOSE' },
  { ticker: 'SCR', name: 'Công ty Cổ phần Địa ốc Sài Gòn Thương Tín', exchange: 'HOSE' },
  { ticker: 'AGG', name: 'Công ty Cổ phần Đầu tư và Phát triển Bất động sản An Gia', exchange: 'HOSE' },
  { ticker: 'TCH', name: 'Công ty Cổ phần Đầu tư Dịch vụ Tài chính Hoàng Huy', exchange: 'HOSE' },
  { ticker: 'HDG', name: 'Công ty Cổ phần Tập đoàn Hà Đô', exchange: 'HOSE' },
  { ticker: 'SZC', name: 'Công ty Cổ phần Sonadezi Châu Đức', exchange: 'HOSE' },
  { ticker: 'SIP', name: 'Công ty Cổ phần Đầu tư Sài Gòn VRG', exchange: 'UPCOM' },
  { ticker: 'KOS', name: 'Công ty Cổ phần Kosy', exchange: 'HOSE' },
  { ticker: 'NTL', name: 'Công ty Cổ phần Phát triển Đô thị Từ Liêm', exchange: 'HOSE' },
];

// Deterministic LCG so every reload produces the same fixture (golden-path predictability).
function rand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 0x100000000;
    return s / 0x100000000;
  };
}

const SECTORS = ['Residential', 'Industrial Park', 'Retail/Mixed', 'Resort/Hospitality'];

export const STOCK_FIXTURE: StockSeed[] = [
  ...REAL_TICKERS.map((s, i) => ({
    ...s,
    sector: SECTORS[i % SECTORS.length],
    seed: 1000 + i * 17,
  })),
  // 55 fillers — 5 deterministic anchors first so behaviors are stable.
  { ticker: 'MOCK_BUY_STRONG', name: 'Mock Buy Strong', exchange: 'HOSE', sector: 'Residential', seed: 9001 },
  { ticker: 'MOCK_BUY_WARN', name: 'Mock Buy With Warning', exchange: 'HOSE', sector: 'Residential', seed: 9002 },
  { ticker: 'MOCK_HOLD', name: 'Mock Hold', exchange: 'HOSE', sector: 'Industrial Park', seed: 9003 },
  { ticker: 'MOCK_SELL', name: 'Mock Sell', exchange: 'HNX', sector: 'Resort/Hospitality', seed: 9004 },
  { ticker: 'MOCK_INSUFFICIENT', name: 'Mock Insufficient Data', exchange: 'UPCOM', sector: 'Retail/Mixed', seed: 9005 },
  ...Array.from({ length: 50 }, (_, i) => {
    const idx = i + 1;
    const exchange = (['HOSE', 'HNX', 'UPCOM'] as const)[i % 3];
    return {
      ticker: `MOCK${String(idx).padStart(2, '0')}`,
      name: `Mock Real Estate ${idx}`,
      exchange,
      sector: SECTORS[i % SECTORS.length],
      seed: 5000 + idx * 13,
    };
  }),
];

// 81 total — sanity check at module load (no test runner, this is the next-best thing).
if (STOCK_FIXTURE.length !== 81) {
  // eslint-disable-next-line no-console
  console.warn(`[stocks-fixture] expected 81 entries, got ${STOCK_FIXTURE.length}`);
}

// Reason templates — pre-baked per GUARD-02. Each maps to a real feature ID.
// Numeric placeholder {v} is filled per-ticker; templates are deterministic, never LLM-generated.
export interface ReasonTemplate {
  group: 'fundamental' | 'valuation' | 'technical' | 'sentiment' | 'macro' | 'realestate';
  text: (v: number) => string;
  feature_id: string;
  valueRange: [number, number];
}

export const REASON_TEMPLATES: ReasonTemplate[] = [
  { group: 'fundamental', text: (v) => `ROE cao (${v.toFixed(1)}%)`, feature_id: 'F03', valueRange: [12, 22] },
  { group: 'fundamental', text: (v) => `D/E thấp (${v.toFixed(1)})`, feature_id: 'F06', valueRange: [0.4, 1.2] },
  { group: 'fundamental', text: (v) => `OCF dương (${v.toFixed(0)} tỷ)`, feature_id: 'F10', valueRange: [120, 800] },
  { group: 'fundamental', text: (v) => `Doanh thu tăng ${v.toFixed(0)}%`, feature_id: 'F08', valueRange: [10, 35] },
  { group: 'valuation', text: (v) => `Chiết khấu NAV ${v.toFixed(0)}%`, feature_id: 'R04', valueRange: [10, 30] },
  { group: 'valuation', text: (v) => `P/E hợp lý (${v.toFixed(1)})`, feature_id: 'F01', valueRange: [8, 14] },
  { group: 'valuation', text: (v) => `P/B thấp (${v.toFixed(2)})`, feature_id: 'F02', valueRange: [0.7, 1.4] },
  { group: 'technical', text: () => 'Tín hiệu kỹ thuật tích cực', feature_id: 'T01', valueRange: [60, 85] },
  { group: 'technical', text: (v) => `RSI ổn định (${v.toFixed(0)})`, feature_id: 'T03', valueRange: [45, 65] },
  { group: 'technical', text: () => 'MACD cắt lên trên đường 0', feature_id: 'T04', valueRange: [0, 1] },
  { group: 'sentiment', text: (v) => `Sentiment tích cực (${v.toFixed(2)})`, feature_id: 'S01', valueRange: [0.3, 0.7] },
  { group: 'macro', text: () => 'Lãi suất đi xuống hỗ trợ ngành', feature_id: 'M02', valueRange: [0, 1] },
  { group: 'realestate', text: (v) => `Quỹ đất ${v.toFixed(0)} ha`, feature_id: 'R01', valueRange: [80, 600] },
];
