// Compose a full StockDetailResponse for a given (run, ticker) by enriching the
// per-run ScreeningResult with: 38-feature dictionary values, raw indicators (S/R, MA, RSI…),
// and a reason_code derived from the entry signal.
//
// This is purely deterministic per (run_master_seed, ticker_seed) so demos reproduce.

import type { Recommendation, EntrySignal } from '@/lib/constants';
import type { ScreeningResult, StockDetailResponse } from '@/lib/types';

import { FEATURE_DICT, type FeatureGroup } from './feature-dict';
import { DEFAULT_REASON_BY_SIGNAL } from './reason-codes';
import { STOCK_FIXTURE } from './stocks-fixture';

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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Map the radar group score (0..100) to a value within [range[0], range[1]].
// Direction-aware: a "high is good" feature with a high group score → tend toward range top.
// "low is good" inverts. "none" → centered on midpoint with mild jitter.
function valueFromGroupScore(
  groupScore: number,
  direction: 'high' | 'low' | 'none',
  range: [number, number],
  jitter: () => number,
): number {
  const t = clamp(groupScore / 100, 0, 1);
  const span = range[1] - range[0];
  const noise = (jitter() - 0.5) * 0.18 * span;
  if (direction === 'high') return range[0] + t * span + noise;
  if (direction === 'low') return range[1] - t * span + noise;
  return range[0] + 0.5 * span + noise * 1.6;
}

function pickGroupScore(result: ScreeningResult, group: FeatureGroup): number {
  switch (group) {
    case 'fundamental':
      return result.radar.fundamental;
    case 'technical':
      return result.radar.technical;
    case 'macro':
      return result.radar.macro;
    case 'realestate':
      return result.radar.realestate;
    case 'sentiment':
      return result.radar.sentiment;
  }
}

// Per-period RSI / MA / Bollinger / S-R are derived from the technical group score so the
// breakdown stays internally consistent (high tech score → bullish indicators).
function buildRawIndicators(args: {
  rnd: () => number;
  current_price: number;
  technical: number;
  signal: EntrySignal;
}): StockDetailResponse['raw_indicators'] & {
  support_zone: number;
  resistance_zone: number;
} {
  const { rnd, current_price, technical, signal } = args;

  // RSI band by entry signal — keeps each fixture self-explanatory in the UI.
  const rsi = (() => {
    switch (signal) {
      case 'BUY_STRONG':
        return 50 + rnd() * 8; // 50..58
      case 'BUY_NOW':
        return 52 + rnd() * 8;
      case 'WAIT_FOR_PULLBACK':
        return 65 + rnd() * 8; // 65..73 (overbought-ish)
      case 'WAIT_FOR_BREAKOUT':
        return 55 + rnd() * 8;
      case 'WAIT_FOR_CONFIRMATION':
        return 48 + rnd() * 6;
      case 'NO_ENTRY':
        return technical < 50 ? 35 + rnd() * 10 : 72 + rnd() * 6;
      case 'INSUFFICIENT_DATA':
      default:
        return 50 + rnd() * 6;
    }
  })();

  // MA20 ~ price ±2-4%, MA50/200 trail further. For BUY_* keep price > MA20 > MA50.
  const ma20 =
    signal === 'BUY_STRONG' || signal === 'BUY_NOW'
      ? current_price * (0.96 + rnd() * 0.025)
      : current_price * (0.97 + rnd() * 0.05);
  const ma50 = current_price * (0.92 + rnd() * 0.06);
  const ma200 = current_price * (0.85 + rnd() * 0.08);

  const ema12 = current_price * (0.97 + rnd() * 0.04);
  const ema26 = current_price * (0.94 + rnd() * 0.05);

  // Bollinger ~ MA20 ± 2σ
  const sigma = current_price * 0.025;
  const bollinger_upper = ma20 + 2 * sigma;
  const bollinger_lower = ma20 - 2 * sigma;

  // MACD histogram positive for BUY signals, negative for NO_ENTRY/SELL flavor.
  const macd_histogram =
    signal === 'BUY_STRONG' || signal === 'BUY_NOW' || signal === 'WAIT_FOR_BREAKOUT'
      ? 0.1 + rnd() * 0.6
      : signal === 'NO_ENTRY'
        ? -0.6 - rnd() * 0.4
        : -0.1 + rnd() * 0.3;

  const macd_signal_cross =
    signal === 'BUY_NOW' || signal === 'BUY_STRONG' ? rnd() > 0.4 : false;

  // Support / resistance — keep current price between them; tighten near resistance for breakout.
  const support_zone =
    signal === 'WAIT_FOR_PULLBACK'
      ? current_price * (0.92 + rnd() * 0.03)
      : current_price * (0.89 + rnd() * 0.05);
  const resistance_zone =
    signal === 'WAIT_FOR_BREAKOUT'
      ? current_price * (1.005 + rnd() * 0.025) // very close, ≤3%
      : current_price * (1.06 + rnd() * 0.06);

  return {
    ma20: Number(ma20.toFixed(2)),
    ma50: Number(ma50.toFixed(2)),
    ma200: Number(ma200.toFixed(2)),
    ema12: Number(ema12.toFixed(2)),
    ema26: Number(ema26.toFixed(2)),
    rsi: Number(rsi.toFixed(1)),
    macd_histogram: Number(macd_histogram.toFixed(3)),
    macd_signal_cross,
    bollinger_upper: Number(bollinger_upper.toFixed(2)),
    bollinger_lower: Number(bollinger_lower.toFixed(2)),
    support_zone: Number(support_zone.toFixed(2)),
    resistance_zone: Number(resistance_zone.toFixed(2)),
  };
}

function buildFeatures(
  result: ScreeningResult,
  rnd: () => number,
): { features: Record<string, number>; imputed: string[]; availability: number } {
  const features: Record<string, number> = {};
  const imputed: string[] = [];

  // 0-3 features imputed (most runs have 36-38 available — TAD §4 mock).
  const imputeCount = Math.floor(rnd() * 4); // 0..3
  const imputeIdxs = new Set<number>();
  while (imputeIdxs.size < imputeCount) {
    imputeIdxs.add(Math.floor(rnd() * FEATURE_DICT.length));
  }

  FEATURE_DICT.forEach((meta, idx) => {
    const groupScore = pickGroupScore(result, meta.group);
    const value = valueFromGroupScore(groupScore, meta.direction, meta.range, rnd);
    features[meta.id] = Number(value.toFixed(2));
    if (imputeIdxs.has(idx)) imputed.push(meta.id);
  });

  return {
    features,
    imputed,
    availability: FEATURE_DICT.length - imputed.length,
  };
}

interface StockDetailComputeArgs {
  result: ScreeningResult;
  run_id: string;
  master_seed: number;
  /** Industry average for the radar overlay — typically the run's dashboard radar. */
  industry_avg?: ScreeningResult['radar'];
}

export function buildStockDetail(args: StockDetailComputeArgs): StockDetailResponse {
  const { result, run_id, master_seed, industry_avg } = args;

  // Compose a per-(run, ticker) seed so reloads are deterministic but each run differs.
  const seedRow = STOCK_FIXTURE.find((s) => s.ticker === result.ticker);
  const tickerSeed = seedRow ? seedRow.seed : 0;
  const rnd = mulberry32(master_seed + tickerSeed * 7);

  const ind = buildRawIndicators({
    rnd,
    current_price: result.current_price,
    technical: result.radar.technical,
    signal: result.entry_signal,
  });

  const { features, imputed, availability } = buildFeatures(result, rnd);

  // Derive raw_indicators_used by signal — audit trail per SRS-03 output.
  const rawIndicatorsUsed = ((): string[] => {
    switch (result.entry_signal) {
      case 'BUY_STRONG':
      case 'BUY_NOW':
        return ['MA20', 'RSI', 'MACD_HIST', 'NAV', 'BOLLINGER'];
      case 'WAIT_FOR_BREAKOUT':
        return ['RESISTANCE', 'RSI', 'MA20'];
      case 'WAIT_FOR_PULLBACK':
        return ['RSI', 'MA20', 'BOLLINGER_UPPER'];
      case 'WAIT_FOR_CONFIRMATION':
        return ['MACD', 'MA20'];
      case 'NO_ENTRY':
        return ['REC', 'RSI'];
      case 'INSUFFICIENT_DATA':
      default:
        return [];
    }
  })();

  const reason_code = DEFAULT_REASON_BY_SIGNAL[result.entry_signal].join('+');

  // Stop loss / allocation — fall back to current_price when ScreeningResult skipped them
  // (e.g. recommendation ≠ MUA didn't get an allocation). We still show a stop loss for risk
  // education, but mark `has_buy_price: false` so the UI explains the calc clearly.
  const has_buy_price = result.recommendation === 'MUA';
  const stop_loss_price = has_buy_price
    ? (result.stop_loss_price ?? Number((result.current_price * 0.9).toFixed(2)))
    : Number((result.current_price * 0.9).toFixed(2));

  const detail: StockDetailResponse = {
    ticker: result.ticker,
    name: result.name,
    run_id,
    static: {
      ticker: result.ticker,
      name: result.name,
      exchange: result.exchange,
      sector: result.sector,
      current_price: result.current_price,
      reference_price: Number((result.current_price * (1 + (rnd() - 0.5) * 0.02)).toFixed(2)),
    },
    scoring: {
      ai_score: result.ai_score,
      recommendation: result.recommendation as Recommendation,
      confidence_raw: result.confidence_raw,
      confidence_penalty: result.confidence_penalty,
      confidence: result.confidence,
      target_price_3m: result.target_price_3m,
      upside_pct: result.upside_pct,
    },
    entry: {
      signal: result.entry_signal,
      reason_code,
      support_zone: ind.support_zone,
      resistance_zone: ind.resistance_zone,
      raw_indicators_used: rawIndicatorsUsed,
    },
    raw_indicators: {
      ma20: ind.ma20,
      ma50: ind.ma50,
      ma200: ind.ma200,
      ema12: ind.ema12,
      ema26: ind.ema26,
      rsi: ind.rsi,
      macd_histogram: ind.macd_histogram,
      macd_signal_cross: ind.macd_signal_cross,
      bollinger_upper: ind.bollinger_upper,
      bollinger_lower: ind.bollinger_lower,
    },
    risk: {
      stop_loss_price,
      allocation_amount: result.allocation_amount ?? 0,
      allocation_weight: result.allocation_weight ?? 0,
      warning_badges: result.warning_badges,
      has_buy_price,
    },
    reasons: result.reasons,
    features,
    imputed_features: imputed,
    feature_availability: availability,
    radar: result.radar,
    radar_industry_avg: industry_avg,
  };

  return detail;
}
