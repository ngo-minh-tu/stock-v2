'use client';

// Tiny aliases over useApiResource so the page code reads cleanly. Keep here so future
// caching / SWR migration touches one file.

import { useApiResource } from './useApiResource';

import type {
  CandleInterval,
  CandleLookback,
  StockDetailResponse,
  StockPricesResponse,
  TickerRunsResponse,
} from '@/lib/types';

export function useStockDetail(runId: string | null, ticker: string | null, reloadKey = 0) {
  const path = runId && ticker ? `/api/runs/${runId}/stocks/${ticker}` : null;
  return useApiResource<StockDetailResponse>(path, reloadKey);
}

export function useStockPrices(
  ticker: string | null,
  interval: CandleInterval,
  lookback: CandleLookback,
  reloadKey = 0,
) {
  const path = ticker
    ? `/api/stocks/${ticker}/prices?interval=${interval}&lookback=${lookback}`
    : null;
  return useApiResource<StockPricesResponse>(path, reloadKey);
}

export function useTickerRuns(ticker: string | null, reloadKey = 0) {
  const path = ticker ? `/api/stocks/${ticker}/runs` : null;
  return useApiResource<TickerRunsResponse>(path, reloadKey);
}
