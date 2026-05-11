// Deterministic latest-price snapshot for the Price Board (cluster 4).
// Each ticker gets a coherent (reference, ceiling, floor, open, high, low, close, volume)
// via its `seed`. We anchor `close` to the latest run's `current_price` when available so
// a ticker's price stays consistent across pages — header (cluster 3) and price board (cluster 4).

import type { Exchange } from '@/lib/constants';
import type { LatestPrice, StockListItem } from '@/lib/types';

import { runsStore } from './runs-store';
import { STOCK_FIXTURE, type StockSeed } from './stocks-fixture';

// HOSE 7%, HNX 10%, UPCOM 15% — actual VN exchange daily price band rules.
const BAND_BY_EXCHANGE: Record<Exchange, number> = {
  HOSE: 0.07,
  HNX: 0.10,
  UPCOM: 0.15,
};

// Tagging a deterministic 6 stocks as "newly listed" so AC-04 (filter) has a result set.
// Index-based to avoid touching the fixture shape.
const NEWLY_LISTED_INDEXES = new Set<number>([5, 17, 31, 46, 58, 73]);

function rngFromSeed(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b1) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Round to the VN tick size convention used in the prototype (1 unit = 1k VND, 2 decimals OK).
function r2(n: number): number {
  return Number(n.toFixed(2));
}

interface PriceInputs {
  seed: StockSeed;
  /** Anchored close (ngàn đồng) — falls back to a seed-derived value if no run is available. */
  anchoredClose: number;
}

function computeLatestPrice({ seed, anchoredClose }: PriceInputs): LatestPrice {
  const rng = rngFromSeed(seed.seed * 31 + 7);
  const band = BAND_BY_EXCHANGE[seed.exchange];

  // Reference: previous-session close. Wobble close ±2.5% to derive a plausible reference.
  const refDriftPct = (rng() - 0.5) * 0.05; // -2.5% .. +2.5%
  const reference = r2(anchoredClose / (1 + refDriftPct));

  // Forced anchor cases — every 12th seed lands at ceiling, every 13th at floor, every 17th
  // exactly on reference. Keeps the 5-color TTCK rule covered for AC #2 without relying
  // on luck. (Compose checks with strict equality, so we mirror the priceColor() logic.)
  let close = anchoredClose;
  if (seed.seed % 12 === 0) close = r2(reference * (1 + band)); // ceiling
  else if (seed.seed % 13 === 0) close = r2(reference * (1 - band)); // floor
  else if (seed.seed % 17 === 0) close = reference; // ref

  const ceiling = r2(reference * (1 + band));
  const floor = r2(reference * (1 - band));

  // Open within ±band/2 of reference, then clamp to [floor, ceiling].
  const openRaw = reference * (1 + (rng() - 0.5) * band);
  const open = r2(Math.min(ceiling, Math.max(floor, openRaw)));

  // High/Low respect open & close + small noise; clamp to band.
  const highBase = Math.max(open, close) * (1 + rng() * (band / 4));
  const lowBase = Math.min(open, close) * (1 - rng() * (band / 4));
  const high = r2(Math.min(ceiling, highBase));
  const low = r2(Math.max(floor, lowBase));

  // Volume 100K – 2M with a 5% spike chance up to 5M.
  const spike = rng() < 0.05;
  const volBase = 100_000 + rng() * 1_900_000;
  const volume = Math.round(spike ? volBase + rng() * 3_000_000 : volBase);

  return { reference, ceiling, floor, open, high, low, close, volume };
}

/** Snapshot the entire 81-stock universe with a coherent latest price + newly-listed flag. */
export function buildPriceBoardItems(): StockListItem[] {
  const latestRun = runsStore.latest();
  const computedByTicker = new Map<string, number>();
  if (latestRun?.computed) {
    for (const r of latestRun.computed.results) {
      computedByTicker.set(r.ticker, r.current_price);
    }
  }

  return STOCK_FIXTURE.map((seed, i) => {
    const fromRun = computedByTicker.get(seed.ticker);
    const fallback = 12 + (seed.seed % 80) + Number(((seed.seed * 7) % 100) / 100); // 12..92, 2dp
    const anchoredClose = fromRun ?? r2(fallback);
    const latest_price = computeLatestPrice({ seed, anchoredClose });
    return {
      ticker: seed.ticker,
      name: seed.name,
      exchange: seed.exchange,
      sector: seed.sector,
      current_price: latest_price.close,
      reference_price: latest_price.reference,
      latest_price,
      newly_listed: NEWLY_LISTED_INDEXES.has(i),
    } satisfies StockListItem;
  });
}

/** Sorted list of unique sectors present in the fixture (for the sector dropdown). */
export function listSectors(): string[] {
  const set = new Set<string>(STOCK_FIXTURE.map((s) => s.sector));
  return [...set].sort();
}
