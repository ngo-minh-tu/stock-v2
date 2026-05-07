// OHLCV history mock — deterministic per ticker via mulberry32.
// Generates up to 250 trading days (1Y) on demand; a shorter `period` slices the tail.
// Used by GET /api/stocks/{ticker}/prices.

import type { OhlcvBar, StockPricesResponse } from '@/lib/types';

import { STOCK_FIXTURE } from './stocks-fixture';

export type PricePeriod = '1M' | '3M' | '6M' | '1Y';

const PERIOD_DAYS: Record<PricePeriod, number> = {
  '1M': 22,
  '3M': 66,
  '6M': 125,
  '1Y': 250,
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

// Walk forward from a starting price using a small daily drift + gaussian shock.
// We anchor the *last* day at `currentPrice` by computing the walk forward from a back-calculated
// start, so the chart's right edge always matches the displayed current price.
function generateBars(args: {
  seed: number;
  days: number;
  currentPrice: number;
}): OhlcvBar[] {
  const { seed, days, currentPrice } = args;
  const rnd = mulberry32(seed);

  // Daily volatility ~1.6% with slight drift; final price will be close to currentPrice
  // because we overwrite the last close. Intermediate prices reflect the random walk.
  const dailyVol = 0.018;
  const drift = 0.0008;

  // Start price ~10–25% away from current (shows realistic 6-month movement).
  const startPrice = currentPrice * (0.85 + rnd() * 0.25);

  const closes: number[] = [];
  let p = startPrice;
  for (let i = 0; i < days; i += 1) {
    const shock = gaussish(rnd) * dailyVol * p;
    p = Math.max(p + drift * p + shock, currentPrice * 0.5);
    closes.push(p);
  }
  // Anchor last close to currentPrice so the chart's right edge matches.
  closes[closes.length - 1] = currentPrice;

  // Compose OHLCV per day.
  const bars: OhlcvBar[] = [];
  // End date = today (UTC midnight to avoid TZ shifts in the chart).
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < days; i += 1) {
    const close = closes[i];
    const open = i === 0 ? startPrice : closes[i - 1];
    // Intraday spread ±1.5% from min(open, close) / max(open, close)
    const lo = Math.min(open, close) * (1 - rnd() * 0.012);
    const hi = Math.max(open, close) * (1 + rnd() * 0.012);
    // Volume: log-uniform 200K..2M with occasional spike.
    const baseVol = 200_000 + rnd() * 1_800_000;
    const spike = rnd() < 0.05 ? 2 + rnd() * 3 : 1;
    const volume = Math.round(baseVol * spike);

    // Date = today - (days - 1 - i) calendar days. Skip weekends.
    const offset = days - 1 - i;
    const d = new Date(today);
    let weekend_skip = 0;
    d.setUTCDate(d.getUTCDate() - offset);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
      d.setUTCDate(d.getUTCDate() - 1);
      weekend_skip += 1;
      if (weekend_skip > 4) break; // safety
    }

    bars.push({
      date: d.toISOString().slice(0, 10),
      open: Number(open.toFixed(2)),
      high: Number(hi.toFixed(2)),
      low: Number(lo.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }

  // Ensure dates are ascending unique (weekend skips can collide on rare boundary).
  const seen = new Set<string>();
  return bars.filter((b) => {
    if (seen.has(b.date)) return false;
    seen.add(b.date);
    return true;
  });
}

export function getPrices(args: {
  ticker: string;
  period: PricePeriod;
  currentPrice: number;
}): StockPricesResponse | null {
  const seed = findTickerSeed(args.ticker);
  if (seed === null) return null;
  const days = PERIOD_DAYS[args.period];
  // Mix period into the seed so 1M/3M/6M/1Y don't collapse to identical sub-ranges
  // (otherwise the 1Y tail would just be the same data zoomed out).
  const bars = generateBars({
    seed: seed + days * 31,
    days,
    currentPrice: args.currentPrice,
  });
  return { ticker: args.ticker, period: args.period, bars };
}
