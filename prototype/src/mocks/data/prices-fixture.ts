// OHLCV history mock — deterministic per ticker via mulberry32.
// Generates 1500 trading days (≈6 năm) up-front so:
//   - 5-year "All" lookback fits within the cached set
//   - MA200 has 200 padding bars even when lookback is 1T (22 bars)
// Used by GET /api/stocks/{ticker}/prices.

import type {
  CandleInterval,
  CandleLookback,
  OhlcvBar,
  PriceIndicators,
  StockPricesResponse,
} from '@/lib/types';

import { STOCK_FIXTURE } from './stocks-fixture';

// Total daily bars generated per ticker. 1500 ≈ 6 năm trading days, giving
// 1250 (5y "All") + 200+ headroom for MA200 padding the chart hooks may request.
const BASE_DAYS = 1500;

// Trading-day count per lookback for the daily interval.
// W and M aggregations slice from these counts via aggregation, so we only
// need this single source of truth.
const LOOKBACK_DAILY_BARS: Record<Exclude<CandleLookback, 'YTD' | 'All'>, number> = {
  '1T': 22,
  '3T': 66,
  '6T': 125,
  '1N': 250,
  '3N': 750,
};

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

// Box-Muller-ish — sum of 3 uniforms biased toward 0.
function gaussish(rnd: () => number): number {
  return rnd() + rnd() + rnd() - 1.5;
}

function findTickerSeed(ticker: string): number | null {
  const s = STOCK_FIXTURE.find((x) => x.ticker === ticker);
  return s ? s.seed : null;
}

// Build a list of `count` trading-day Date objects ending today (UTC midnight),
// skipping weekends. Returns ascending order (oldest at index 0).
function tradingDaysEndingToday(count: number): Date[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // If today is weekend, walk back to last Friday.
  while (today.getUTCDay() === 0 || today.getUTCDay() === 6) {
    today.setUTCDate(today.getUTCDate() - 1);
  }
  const dates: Date[] = [];
  const cur = new Date(today);
  while (dates.length < count) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return dates.reverse();
}

// Walk forward from a starting price using a small daily drift + gaussian shock.
// We then *scale* the entire walk so the last close lands on `currentPrice`,
// preserving the walk's shape (volatility, trend) while guaranteeing the right
// edge matches the displayed price. A bare overwrite of the final close (which
// the prior implementation did) leaves a cliff at the right edge — earlier bars
// kept their drifted-up levels, blowing the y-axis when overlays anchored to
// current_price are added to the chart.
function generateDailyBars(args: {
  seed: number;
  currentPrice: number;
}): OhlcvBar[] {
  const { seed, currentPrice } = args;
  const rnd = mulberry32(seed);

  const dailyVol = 0.018;
  const drift = 0.0005;

  // Start price ~30–60% away from current — wider band for 6-year span.
  const startPrice = currentPrice * (0.4 + rnd() * 0.3);

  const closes: number[] = [];
  let p = startPrice;
  for (let i = 0; i < BASE_DAYS; i += 1) {
    const shock = gaussish(rnd) * dailyVol * p;
    p = Math.max(p + drift * p + shock, currentPrice * 0.25);
    closes.push(p);
  }
  // Scale the whole series so the last close == currentPrice. Multiplicative scale
  // preserves all relative moves (% returns, volatility, trend shape).
  const scale = closes[closes.length - 1] > 0 ? currentPrice / closes[closes.length - 1] : 1;
  for (let i = 0; i < closes.length; i += 1) closes[i] *= scale;

  const dates = tradingDaysEndingToday(BASE_DAYS);

  const bars: OhlcvBar[] = [];
  const scaledStartPrice = startPrice * scale;
  for (let i = 0; i < BASE_DAYS; i += 1) {
    const close = closes[i];
    const open = i === 0 ? scaledStartPrice : closes[i - 1];
    const lo = Math.min(open, close) * (1 - rnd() * 0.012);
    const hi = Math.max(open, close) * (1 + rnd() * 0.012);
    const baseVol = 200_000 + rnd() * 1_800_000;
    const spike = rnd() < 0.05 ? 2 + rnd() * 3 : 1;
    const volume = Math.round(baseVol * spike);

    bars.push({
      date: dates[i].toISOString().slice(0, 10),
      open: Number(open.toFixed(2)),
      high: Number(hi.toFixed(2)),
      low: Number(lo.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }
  return bars;
}

// Cache the full daily series per (ticker, currentPrice) so toggling interval
// D ↔ W ↔ M serves consistent aggregations of the same underlying data.
const dailyCache = new Map<string, OhlcvBar[]>();
function getOrBuildDaily(ticker: string, seed: number, currentPrice: number): OhlcvBar[] {
  const key = `${ticker}:${currentPrice.toFixed(2)}`;
  const hit = dailyCache.get(key);
  if (hit) return hit;
  const bars = generateDailyBars({ seed: seed + 31, currentPrice });
  dailyCache.set(key, bars);
  return bars;
}

// ISO week key 'YYYY-Www' from a YYYY-MM-DD string.
function isoWeekKey(yyyymmdd: string): string {
  const dt = new Date(`${yyyymmdd}T00:00:00Z`);
  // Move to Thursday of the same ISO week — ISO 8601 anchor.
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function monthKey(yyyymmdd: string): string {
  return yyyymmdd.slice(0, 7); // YYYY-MM
}

// Aggregate consecutive daily bars into W or M buckets.
// Bar date = the LAST daily bar's date inside that bucket (chart-friendly).
function aggregate(bars: OhlcvBar[], interval: CandleInterval): OhlcvBar[] {
  if (interval === 'D') return bars;
  const keyOf = interval === 'W' ? isoWeekKey : monthKey;
  const out: OhlcvBar[] = [];
  let bucket: OhlcvBar[] = [];
  let bucketKey: string | null = null;
  const flush = () => {
    if (bucket.length === 0) return;
    const open = bucket[0].open;
    const close = bucket[bucket.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const b of bucket) {
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
      volume += b.volume;
    }
    out.push({
      date: bucket[bucket.length - 1].date,
      open,
      high,
      low,
      close,
      volume,
    });
  };
  for (const b of bars) {
    const k = keyOf(b.date);
    if (k !== bucketKey) {
      flush();
      bucket = [];
      bucketKey = k;
    }
    bucket.push(b);
  }
  flush();
  return out;
}

// How many trailing bars to keep for `lookback` at a given interval.
// YTD/All are computed dynamically, others map via LOOKBACK_DAILY_BARS scaled.
function tailCount(
  bars: OhlcvBar[],
  interval: CandleInterval,
  lookback: CandleLookback,
): number {
  if (lookback === 'All') return bars.length;
  if (lookback === 'YTD') {
    if (bars.length === 0) return 0;
    const lastYear = bars[bars.length - 1].date.slice(0, 4);
    let i = bars.length - 1;
    while (i >= 0 && bars[i].date.slice(0, 4) === lastYear) i -= 1;
    return bars.length - 1 - i;
  }
  const dailyBars = LOOKBACK_DAILY_BARS[lookback];
  if (interval === 'D') return dailyBars;
  if (interval === 'W') return Math.max(1, Math.round(dailyBars / 5));
  // Monthly: ~22 trading days/month; minimum 1 bar.
  return Math.max(1, Math.round(dailyBars / 22));
}

// Simple SMA — emits null for the first (period-1) entries (insufficient history).
// Computed on the FULL aggregated series before lookback slicing so the visible
// window inherits "warm" MA values from the padding bars to its left.
function computeSMA(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i += 1) sum += values[i];
  out[period - 1] = Number((sum / period).toFixed(2));
  for (let i = period; i < values.length; i += 1) {
    sum += values[i] - values[i - period];
    out[i] = Number((sum / period).toFixed(2));
  }
  return out;
}

export function getPrices(args: {
  ticker: string;
  interval: CandleInterval;
  lookback: CandleLookback;
  currentPrice: number;
}): StockPricesResponse | null {
  const seed = findTickerSeed(args.ticker);
  if (seed === null) return null;
  const daily = getOrBuildDaily(args.ticker, seed, args.currentPrice);
  const aggregated = aggregate(daily, args.interval);
  // Compute MAs on the full series so a visible bar at index 0 of the window
  // can still inherit a warm MA from earlier (hidden) bars.
  const closes = aggregated.map((b) => b.close);
  const volumes = aggregated.map((b) => b.volume);
  const ma20Full = computeSMA(closes, 20);
  const ma50Full = computeSMA(closes, 50);
  const ma200Full = computeSMA(closes, 200);
  const maVol20Full = computeSMA(volumes, 20);

  const n = tailCount(aggregated, args.interval, args.lookback);
  const bars = aggregated.slice(-n);
  const indicators: PriceIndicators = {
    ma20: ma20Full.slice(-n),
    ma50: ma50Full.slice(-n),
    ma200: ma200Full.slice(-n),
    ma_volume_20: maVol20Full.slice(-n),
  };
  return {
    ticker: args.ticker,
    interval: args.interval,
    lookback: args.lookback,
    bars,
    indicators,
  };
}
