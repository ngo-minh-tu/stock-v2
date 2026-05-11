// Pure functions that turn the static stock fixture into a deterministic run result.
// Kept separate from runs-store so the same compute can be reused for "pre-seeded" historical runs.

import type {
  EntrySignal,
  ExcludedReasonCode,
  ExcludedRound,
  Recommendation,
  WarningBadge,
} from '@/lib/constants';
import type {
  DashboardResponse,
  ExcludedStock,
  RunSummary,
  ScreeningReason,
  ScreeningResult,
} from '@/lib/types';

import { REASON_TEMPLATES, STOCK_FIXTURE, type StockSeed } from './stocks-fixture';

// Mulberry32 — small deterministic PRNG. We avoid Math.random so two reloads produce identical
// data, which makes the "Treemap render" demo + screenshots reproducible.
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

function bellish(rnd: () => number, mean: number, spread: number): number {
  // Sum of 3 uniform → roughly bell. Centered on mean, ±spread.
  const r = (rnd() + rnd() + rnd()) / 3;
  return mean + (r - 0.5) * 2 * spread;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pickReasons(rnd: () => number, count: number): ScreeningReason[] {
  const pool = [...REASON_TEMPLATES];
  const out: ScreeningReason[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const idx = Math.floor(rnd() * pool.length);
    const tpl = pool.splice(idx, 1)[0];
    const v = tpl.valueRange[0] + rnd() * (tpl.valueRange[1] - tpl.valueRange[0]);
    out.push({ text: tpl.text(v), feature_id: tpl.feature_id, value: Number(v.toFixed(2)) });
  }
  return out;
}

function recommendationFromScore(score: number): Recommendation {
  if (score >= 75) return 'MUA';
  if (score >= 45) return 'GIU';
  return 'BAN';
}

// Anchor overrides — satisfies cluster-3 AC #6 (all 7 entry signals must be testable).
// Each override sets the entry signal for a known fixture; score is bumped to make rec=MUA
// where the chosen signal demands it (SRS-03 priority Step 2: rec≠MUA → NO_ENTRY).
const ANCHOR_ENTRY_OVERRIDES: Record<string, EntrySignal> = {
  VHM: 'BUY_STRONG',
  KDH: 'BUY_NOW',
  NLG: 'WAIT_FOR_BREAKOUT',
  DXG: 'WAIT_FOR_PULLBACK',
  PDR: 'WAIT_FOR_CONFIRMATION',
  // MOCK_BUY_STRONG/WARN already covered by score-derivation; MOCK_HOLD/SELL fall through
  // to NO_ENTRY via the recommendation gate; MOCK_INSUFFICIENT is excluded entirely.
};

function decideEntrySignal(
  ticker: string,
  score: number,
  recommendation: Recommendation,
  badges: WarningBadge[],
): EntrySignal {
  // Anchor overrides win — these are demo fixtures.
  if (ANCHOR_ENTRY_OVERRIDES[ticker]) return ANCHOR_ENTRY_OVERRIDES[ticker];

  // SRS-03 Step 2 — rec≠MUA → NO_ENTRY (this fixed a cluster-2 gap where GIU/BAN were
  // returning WAIT_FOR_* signals, contradicting AC-03-02).
  if (recommendation !== 'MUA') return 'NO_ENTRY';
  if (badges.length >= 3) return 'NO_ENTRY';

  if (score >= 90) return 'BUY_STRONG';
  if (score >= 78) return 'BUY_NOW';
  if (score >= 65) return 'WAIT_FOR_PULLBACK';
  if (score >= 55) return 'WAIT_FOR_BREAKOUT';
  if (score >= 45) return 'WAIT_FOR_CONFIRMATION';
  return 'NO_ENTRY';
}

function badgesForSeed(seed: StockSeed, rnd: () => number): WarningBadge[] {
  // Deterministic anchors override the randomness.
  if (seed.ticker === 'MOCK_BUY_WARN') return ['HIGH_INVENTORY'];
  if (seed.ticker === 'MOCK_HOLD') return ['NEGATIVE_OCF'];
  if (seed.ticker === 'MOCK_SELL') return ['HIGH_DEBT', 'LEGAL_RISK'];
  if (seed.ticker === 'MOCK_BUY_STRONG' || seed.ticker === 'MOCK_INSUFFICIENT') return [];
  // KDH carries 1 badge to demo the -5pp confidence penalty per TAD g02 §4 example.
  if (seed.ticker === 'KDH') return ['HIGH_INVENTORY'];

  const badges: WarningBadge[] = [];
  // ~20% chance of any badge, then 50/30/15/5% within
  if (rnd() < 0.2) {
    const r = rnd();
    if (r < 0.5) badges.push('HIGH_INVENTORY');
    else if (r < 0.8) badges.push('HIGH_DEBT');
    else if (r < 0.95) badges.push('NEGATIVE_OCF');
    else badges.push('LEGAL_RISK');
  }
  // small chance of stacking
  if (rnd() < 0.05 && !badges.includes('HIGH_DEBT')) badges.push('HIGH_DEBT');
  return badges;
}

function penaltyForBadges(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 5;
  if (count === 2) return 10;
  return 15;
}

function scoreForSeed(seed: StockSeed, rnd: () => number): number {
  if (seed.ticker === 'MOCK_BUY_STRONG') return 92;
  if (seed.ticker === 'MOCK_BUY_WARN') return 78;
  if (seed.ticker === 'MOCK_HOLD') return 55;
  if (seed.ticker === 'MOCK_SELL') return 30;
  // Anchor scores for the 5 real-ticker entry-signal fixtures (cluster-3 AC #6).
  // All ≥75 to keep recommendation = MUA; spread by signal type so the breakdown looks varied.
  if (seed.ticker === 'VHM') return 91;
  if (seed.ticker === 'KDH') return 82;
  if (seed.ticker === 'NLG') return 78;
  if (seed.ticker === 'DXG') return 76;
  if (seed.ticker === 'PDR') return 75;
  // Bell curve centered ~58 so we get a realistic mix of MUA/GIU/BAN.
  return clamp(Math.round(bellish(rnd, 58, 28)), 8, 95);
}

// One "compute pass" — given the run's master seed + a couple of optional toggles,
// produce results, excluded list, and the dashboard aggregate.
export interface ComputedRun {
  results: ScreeningResult[];
  excluded: ExcludedStock[];
  summary: Omit<RunSummary, 'run_at' | 'status'>;
  dashboard: Omit<DashboardResponse, 'run_at'>;
  total_capital: number;
}

export function computeRun(args: {
  run_id: string;
  master_seed: number;
  total_capital: number;
}): ComputedRun {
  const { run_id, master_seed, total_capital } = args;

  // Vòng 1-4 exclusions: pick deterministic-ish set so demo always shows the Red Flags page populated.
  const excluded: ExcludedStock[] = [];
  const results: ScreeningResult[] = [];

  for (let i = 0; i < STOCK_FIXTURE.length; i += 1) {
    const seed = STOCK_FIXTURE[i];
    const rnd = mulberry32(master_seed + seed.seed);

    // MOCK_INSUFFICIENT always excluded vòng 4.
    if (seed.ticker === 'MOCK_INSUFFICIENT') {
      excluded.push({
        ticker: seed.ticker,
        name: seed.name,
        excluded_round: 4,
        reason_code: 'INSUFFICIENT_DATA',
        reason_text: 'Thiếu BCTC 4 quý liên tiếp',
      });
      continue;
    }

    // ~10% of fillers get filtered for variety (rounds 1-3).
    const filterRoll = rnd();
    if (seed.ticker.startsWith('MOCK') && filterRoll < 0.1) {
      const round = (filterRoll < 0.04 ? 1 : filterRoll < 0.07 ? 2 : 3) as ExcludedRound;
      const code: ExcludedReasonCode =
        round === 1 ? 'HIGH_DE' : round === 2 ? 'PENNY_PRICE' : 'LOW_LIQUIDITY';
      const text =
        round === 1
          ? `D/E = ${(4 + rnd() * 2).toFixed(1)} ≥ 4`
          : round === 2
            ? `Giá ${(8 + rnd() * 6).toFixed(1)}k < 15.000đ`
            : `Khối lượng TB ${(150 + rnd() * 100).toFixed(0)}K cp/phiên < 300K`;
      excluded.push({
        ticker: seed.ticker,
        name: seed.name,
        excluded_round: round,
        reason_code: code,
        reason_text: text,
      });
      continue;
    }

    const score = scoreForSeed(seed, rnd);
    const recommendation = recommendationFromScore(score);
    const badges = badgesForSeed(seed, rnd);
    const penalty = penaltyForBadges(badges.length);
    const confidence_raw = clamp(Math.round(score + bellish(rnd, 0, 6)), 30, 95);
    const confidence = clamp(confidence_raw - penalty, 0, 100);

    const current_price = Number((15 + bellish(rnd, 50, 45)).toFixed(2));
    const upside_pct = Number((bellish(rnd, recommendation === 'MUA' ? 18 : recommendation === 'GIU' ? 4 : -8, 12)).toFixed(1));
    const target_price_3m = Number((current_price * (1 + upside_pct / 100)).toFixed(2));

    const market_cap = Math.round(current_price * (200 + rnd() * 1800)); // tỷ đồng

    const reasonCount = recommendation === 'MUA' ? 4 + Math.floor(rnd() * 2) : 3;
    const reasons = pickReasons(rnd, reasonCount);

    results.push({
      ticker: seed.ticker,
      name: seed.name,
      exchange: seed.exchange,
      sector: seed.sector,
      current_price,
      market_cap,
      ai_score: score,
      recommendation,
      confidence_raw,
      confidence_penalty: penalty,
      confidence,
      target_price_3m,
      upside_pct,
      entry_signal: decideEntrySignal(seed.ticker, score, recommendation, badges),
      buy_price: recommendation === 'MUA' ? current_price : undefined,
      stop_loss_price:
        recommendation === 'MUA' ? Number((current_price * 0.9).toFixed(2)) : undefined,
      warning_badges: badges,
      reasons,
      radar: {
        fundamental: clamp(Math.round(bellish(rnd, score, 12)), 0, 100),
        technical: clamp(Math.round(bellish(rnd, score, 18)), 0, 100),
        macro: clamp(Math.round(bellish(rnd, 55, 12)), 0, 100),
        realestate: clamp(Math.round(bellish(rnd, score, 14)), 0, 100),
        sentiment: clamp(Math.round(bellish(rnd, score - 5, 18)), 0, 100),
      },
    });
  }

  // Capital allocation — only across MUA results, weighted by confidence.
  if (total_capital > 0) {
    const buys = results.filter((r) => r.recommendation === 'MUA');
    const totalConf = buys.reduce((s, r) => s + r.confidence, 0) || 1;
    buys.forEach((r) => {
      const weight = r.confidence / totalConf;
      r.allocation_weight = Number(weight.toFixed(4));
      r.allocation_amount = Math.round(total_capital * weight);
    });
  }

  // Aggregates
  const buy_count = results.filter((r) => r.recommendation === 'MUA').length;
  const hold_count = results.filter((r) => r.recommendation === 'GIU').length;
  const sell_count = results.filter((r) => r.recommendation === 'BAN').length;
  const scored_count = results.length;
  const avg_buy_score =
    buy_count > 0
      ? Number(
          (results.filter((r) => r.recommendation === 'MUA').reduce((s, r) => s + r.ai_score, 0) /
            buy_count).toFixed(1),
        )
      : 0;
  const top_upside_row = results.reduce<ScreeningResult | null>(
    (acc, r) => (acc === null || r.upside_pct > acc.upside_pct ? r : acc),
    null,
  );

  // 6-month sin-wave VN-Index + sector overlay
  const linePoints = Array.from({ length: 26 }, (_, w) => {
    const baseDate = new Date(2026, 0, 1 + w * 7);
    const v = 1200 + Math.sin(w / 4) * 80 + ((master_seed % 50) - 25);
    const sector = v - 50 + Math.cos(w / 3) * 60;
    return {
      date: baseDate.toISOString().slice(0, 10),
      vnindex: Number(v.toFixed(2)),
      sector: Number(sector.toFixed(2)),
    };
  });

  // Radar avg (per group)
  const avgGroup = (key: keyof ScreeningResult['radar']) =>
    scored_count > 0
      ? Math.round(results.reduce((s, r) => s + r.radar[key], 0) / scored_count)
      : 0;

  const dashboard: Omit<DashboardResponse, 'run_at'> = {
    run_id,
    kpi: {
      scored_count,
      buy_count,
      hold_count,
      sell_count,
      avg_buy_score,
      top_upside: top_upside_row
        ? { ticker: top_upside_row.ticker, upside_pct: top_upside_row.upside_pct }
        : null,
      alpha_vs_vnindex_pct: Number((bellish(mulberry32(master_seed), 3.5, 4)).toFixed(1)),
    },
    treemap: results.map((r) => ({
      ticker: r.ticker,
      name: r.name,
      market_cap: r.market_cap,
      recommendation: r.recommendation,
      ai_score: r.ai_score,
    })),
    pie: [
      { recommendation: 'MUA', count: buy_count },
      { recommendation: 'GIU', count: hold_count },
      { recommendation: 'BAN', count: sell_count },
    ],
    line: { points: linePoints },
    bar: [...results]
      .sort((a, b) => b.ai_score - a.ai_score)
      .slice(0, 10)
      .map((r) => ({ ticker: r.ticker, ai_score: r.ai_score, recommendation: r.recommendation })),
    radar: {
      fundamental: avgGroup('fundamental'),
      technical: avgGroup('technical'),
      macro: avgGroup('macro'),
      realestate: avgGroup('realestate'),
      sentiment: avgGroup('sentiment'),
    },
  };

  const avg_score =
    scored_count > 0
      ? Number((results.reduce((s, r) => s + r.ai_score, 0) / scored_count).toFixed(1))
      : 0;

  return {
    results,
    excluded,
    summary: {
      run_id,
      total_input: STOCK_FIXTURE.length,
      scored_count,
      buy_count,
      hold_count,
      sell_count,
      total_capital,
      data_from_cache: false,
      // Defaults — runs-store overrides per-record (model_version, settings_version, duration, warnings_count).
      model_version: 'baseline_v1',
      settings_version: 1,
      duration_seconds: 15,
      warnings_count: 0,
      avg_score,
    },
    dashboard,
    total_capital,
  };
}
