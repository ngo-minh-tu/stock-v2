// Singleton in-memory portfolio store. Cluster 5 §6.1 — CRUD over /api/portfolio.
// Survives across MSW handler invocations within one tab session via globalThis.

import type { PortfolioHolding } from '@/lib/types';

import { STOCK_FIXTURE } from './stocks-fixture';

// Today anchor matches the fixture/news "now" — cluster 4 set 2026-05-07 as the demo day.
const TODAY_ISO = '2026-05-07';
const TODAY_MS = new Date(TODAY_ISO).getTime();

interface SeedHolding {
  ticker: string;
  quantity: number;
  buy_price: number; // ngàn đồng (matches price-board convention)
  daysAgo: number;
  notes: string | null;
}

// Seed 6 holdings drawn from real tickers — covers gain, loss, recent, old positions.
// Buy prices set so that against the fixture/run prices we get a mix of green/red rows.
const SEED_HOLDINGS: SeedHolding[] = [
  { ticker: 'VHM', quantity: 1000, buy_price: 42.0, daysAgo: 120, notes: 'Mua dài hạn theo NAV chiết khấu' },
  { ticker: 'KDH', quantity: 500, buy_price: 28.0, daysAgo: 45, notes: 'Theo Top MUA run trước' },
  { ticker: 'NLG', quantity: 800, buy_price: 36.5, daysAgo: 90, notes: null },
  { ticker: 'DXG', quantity: 1200, buy_price: 22.0, daysAgo: 60, notes: 'Cắt lỗ nếu thủng 19' },
  { ticker: 'PDR', quantity: 600, buy_price: 19.5, daysAgo: 30, notes: null },
  { ticker: 'KBC', quantity: 400, buy_price: 38.0, daysAgo: 14, notes: 'Theo dõi sát ngành KCN' },
];

function ymdFromDaysAgo(daysAgo: number): string {
  const d = new Date(TODAY_MS - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
}

class PortfolioStore {
  private rows = new Map<number, PortfolioHolding>();
  private nextId = 1;

  constructor() {
    SEED_HOLDINGS.forEach((s) => {
      // Skip seeds whose ticker is not in the fixture (defensive).
      if (!STOCK_FIXTURE.some((x) => x.ticker === s.ticker)) return;
      this.add({
        ticker: s.ticker,
        quantity: s.quantity,
        buy_price: s.buy_price,
        buy_date: ymdFromDaysAgo(s.daysAgo),
        notes: s.notes,
      });
    });
  }

  list(): PortfolioHolding[] {
    return [...this.rows.values()].sort((a, b) => a.id - b.id);
  }

  get(id: number): PortfolioHolding | null {
    return this.rows.get(id) ?? null;
  }

  add(input: {
    ticker: string;
    quantity: number;
    buy_price: number;
    buy_date: string;
    notes?: string | null;
  }): PortfolioHolding {
    const id = this.nextId;
    this.nextId += 1;
    const nowIso = new Date().toISOString();
    const row: PortfolioHolding = {
      id,
      ticker: input.ticker.toUpperCase(),
      quantity: input.quantity,
      buy_price: input.buy_price,
      buy_date: input.buy_date,
      notes: input.notes ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.rows.set(id, row);
    return row;
  }

  update(id: number, patch: Partial<PortfolioHolding>): PortfolioHolding | null {
    const row = this.rows.get(id);
    if (!row) return null;
    const updated: PortfolioHolding = {
      ...row,
      ...patch,
      id: row.id,
      ticker: (patch.ticker ?? row.ticker).toUpperCase(),
      created_at: row.created_at,
      updated_at: new Date().toISOString(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  remove(id: number): boolean {
    return this.rows.delete(id);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __portfolioStore: PortfolioStore | undefined;
}

export const portfolioStore: PortfolioStore =
  globalThis.__portfolioStore ?? (globalThis.__portfolioStore = new PortfolioStore());
