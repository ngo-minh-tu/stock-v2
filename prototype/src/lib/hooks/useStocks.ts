'use client';

// Thin wrapper over useApiResource for the cluster 4 endpoints — same pattern as
// useStockDetail/useStockPrices in cluster 3 so a future SWR migration touches one file.

import {
  type NewsDateRange,
  type NewsSourceKey,
  type SentimentLabelKey,
} from '@/lib/constants';
import type {
  NewsListResponse,
  SentimentSummaryResponse,
  StocksListResponse,
} from '@/lib/types';
import { FIXTURE_NOW_MS } from '@/mocks/data/news-fixture';

import { useApiResource } from './useApiResource';

export function useStocks(limit = 100, offset = 0, reloadKey = 0) {
  const path = `/api/stocks?limit=${limit}&offset=${offset}`;
  return useApiResource<StocksListResponse>(path, reloadKey);
}

export interface NewsFilterParams {
  sources: NewsSourceKey[];
  sentiments: SentimentLabelKey[];
  ticker: string | null;
  dateRange: NewsDateRange;
  limit: number;
  offset: number;
  /** Pass a source key (lowercase) to simulate a per-source crawl error (GUARD-08 banner). */
  mockFailure?: string | null;
}

function isoFromDateRange(range: NewsDateRange): string | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  // Anchor to the news fixture's "now" so the UI window matches the corpus dates, regardless
  // of wall-clock date when the user runs the app.
  const ms = FIXTURE_NOW_MS - days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export function buildNewsPath(p: NewsFilterParams): string {
  const params = new URLSearchParams();
  params.set('limit', String(p.limit));
  params.set('offset', String(p.offset));
  for (const s of p.sources) params.append('source', s);
  for (const s of p.sentiments) params.append('sentiment', s);
  if (p.ticker) params.set('ticker', p.ticker);
  const fromIso = isoFromDateRange(p.dateRange);
  if (fromIso) params.set('from', fromIso);
  if (p.mockFailure) params.set('mock_news_failure', p.mockFailure);
  return `/api/news?${params.toString()}`;
}

export function useNews(p: NewsFilterParams, reloadKey = 0) {
  return useApiResource<NewsListResponse>(buildNewsPath(p), reloadKey);
}

export function useSentimentSummary(ticker: string | null, days = 30, reloadKey = 0) {
  const path = ticker ? `/api/news/sentiment/${ticker}?days=${days}` : null;
  return useApiResource<SentimentSummaryResponse>(path, reloadKey);
}
