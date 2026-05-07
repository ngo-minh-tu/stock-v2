// Backtest store — async lifecycle (RUNNING → COMPLETED) mirroring the run state machine.
// Mock metrics from cluster 5 prompt §6.4: accuracy 55-75%, price error 8-18%, ROI 5-25%, alpha = portfolio − VN-Index.

import type {
  BacktestMetrics,
  BacktestResultRow,
  BacktestStatus,
} from '@/lib/types';

import { runsStore } from './runs-store';

interface BacktestRecord {
  backtest_id: number;
  period_from: string;
  period_to: string;
  status: BacktestStatus;
  progress_percent: number;
  current_step: string;
  metrics: BacktestMetrics | null;
  results: BacktestResultRow[] | null;
  error: string | null;
  timers: ReturnType<typeof setTimeout>[];
}

// Deterministic mulberry32 — keeps a backtest's mock metrics stable across reads.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TRANSITIONS: { delayMs: number; status: BacktestStatus; progress: number; step: string }[] = [
  { delayMs: 0, status: 'PENDING', progress: 5, step: 'Khởi tạo backtest' },
  { delayMs: 1500, status: 'RUNNING', progress: 25, step: 'Tải lịch sử giá' },
  { delayMs: 3500, status: 'RUNNING', progress: 55, step: 'Tính returns 3 tháng' },
  { delayMs: 6000, status: 'RUNNING', progress: 80, step: 'Tổng hợp ROI vs VN-Index' },
];
const FINAL_DELAY_MS = 8500;

class BacktestStore {
  private records = new Map<number, BacktestRecord>();
  private nextId = 1;

  start(input: { period_from: string; period_to: string }): BacktestRecord {
    const id = this.nextId;
    this.nextId += 1;
    const record: BacktestRecord = {
      backtest_id: id,
      period_from: input.period_from,
      period_to: input.period_to,
      status: 'PENDING',
      progress_percent: 5,
      current_step: 'Khởi tạo backtest',
      metrics: null,
      results: null,
      error: null,
      timers: [],
    };
    this.records.set(id, record);
    this.scheduleTransitions(record);
    return record;
  }

  get(id: number): BacktestRecord | null {
    return this.records.get(id) ?? null;
  }

  private scheduleTransitions(record: BacktestRecord) {
    TRANSITIONS.forEach((step) => {
      const t = setTimeout(() => {
        const r = this.records.get(record.backtest_id);
        if (!r) return;
        r.status = step.status;
        r.progress_percent = step.progress;
        r.current_step = step.step;
      }, step.delayMs);
      record.timers.push(t);
    });

    const finalT = setTimeout(() => {
      const r = this.records.get(record.backtest_id);
      if (!r) return;
      r.status = 'COMPLETED';
      r.progress_percent = 100;
      r.current_step = 'Hoàn thành';
      const seedNum = record.backtest_id * 1000 + record.period_from.length;
      r.metrics = computeMetrics(record.backtest_id, record.period_from, record.period_to, seedNum);
      r.results = computeResults(record.backtest_id, seedNum);
    }, FINAL_DELAY_MS);
    record.timers.push(finalT);
  }
}

function computeMetrics(
  id: number,
  period_from: string,
  period_to: string,
  seed: number,
): BacktestMetrics {
  const rng = mulberry32(seed);
  // Spec §6.4 ranges:
  const accuracy = 0.55 + rng() * 0.20;            // 0.55-0.75
  const price_error_mean = 8 + rng() * 10;         // 8-18%
  const portfolio_roi = 5 + rng() * 20;            // 5-25%
  const vnindex_roi = 3 + rng() * 12;              // 3-15%
  const alpha = portfolio_roi - vnindex_roi;

  // Reuse latest run's scored_count (cluster 5 prompt §5.3 says "81 ticker rows" — we anchor
  // to the actual scored count of the latest computed run, which fluctuates 70-78).
  const latest = runsStore.latest();
  const total_count = latest?.computed?.results.length ?? 78;
  const correct_count = Math.round(total_count * accuracy);

  // Build a 13-week ROI curve from period_from. Both series start at 0 (cumulative %).
  // VN-Index is the baseline; portfolio is VN-Index + alpha + jitter — so the gap visualises alpha.
  const startMs = new Date(period_from).getTime();
  const endMs = new Date(period_to).getTime();
  const points = Math.max(8, Math.min(26, Math.round((endMs - startMs) / (7 * 86_400_000))));
  const roi_curve: BacktestMetrics['roi_curve'] = [];
  for (let i = 0; i <= points; i += 1) {
    const t = i / points;
    const date = new Date(startMs + t * (endMs - startMs)).toISOString().slice(0, 10);
    const vn = vnindex_roi * t + (rng() - 0.5) * 1.5;
    const port = portfolio_roi * t + (rng() - 0.5) * 1.5;
    roi_curve.push({
      date,
      portfolio: Number(port.toFixed(2)),
      vnindex: Number(vn.toFixed(2)),
    });
  }

  return {
    backtest_id: id,
    status: 'COMPLETED',
    period_from,
    period_to,
    recommendation_accuracy: Number(accuracy.toFixed(3)),
    price_error_mean: Number(price_error_mean.toFixed(2)),
    portfolio_roi: Number(portfolio_roi.toFixed(2)),
    vnindex_roi: Number(vnindex_roi.toFixed(2)),
    alpha: Number(alpha.toFixed(2)),
    roi_curve,
    total_count,
    correct_count,
  };
}

function computeResults(id: number, seed: number): BacktestResultRow[] {
  // Use the latest computed run's tickers as the universe so accuracy/price-error rows look real.
  const latest = runsStore.latest();
  if (!latest?.computed) return [];
  const rng = mulberry32(seed + 999);

  // Targeted accuracy hit-rate ~65% on average — matches the metrics rng range.
  return latest.computed.results.map((r) => {
    const errPct = 5 + rng() * 18; // 5-23%
    const sign = rng() > 0.5 ? 1 : -1;
    const actualReturn = (rng() - 0.4) * 30; // -12 .. +18 %
    const predicted_price = Number((r.target_price_3m).toFixed(2));
    const actual_price = Number((predicted_price * (1 + (sign * errPct) / 100)).toFixed(2));
    const correctness = (() => {
      if (r.recommendation === 'MUA') {
        return actualReturn > 0;
      }
      if (r.recommendation === 'GIU') {
        return actualReturn >= -7 && actualReturn <= 12;
      }
      // BAN
      return actualReturn < 0;
    })();
    return {
      ticker: r.ticker,
      name: r.name,
      predicted_recommendation: r.recommendation,
      actual_return_3m_pct: Number(actualReturn.toFixed(2)),
      predicted_price,
      actual_price,
      price_error_pct: Number(errPct.toFixed(2)),
      recommendation_correct: correctness,
    };
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __backtestStore: BacktestStore | undefined;
}

export const backtestStore: BacktestStore =
  globalThis.__backtestStore ?? (globalThis.__backtestStore = new BacktestStore());
