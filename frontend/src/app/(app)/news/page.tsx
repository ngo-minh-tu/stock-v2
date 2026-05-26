'use client';

import { Filter, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { InfoBanner } from '@/components/common/InfoBanner';
import { NewsFilters, type NewsFilterState } from '@/components/news/NewsFilters';
import { NewsList } from '@/components/news/NewsList';
import { SentimentSummaryWidget } from '@/components/news/SentimentSummaryWidget';
import { useToast } from '@/contexts/ToastContext';
import { apiFetch } from '@/lib/api';
import { useApiResource } from '@/lib/hooks/useApiResource';
import { useSentimentSummary } from '@/lib/hooks/useStocks';
import { NEWS_SOURCES } from '@/lib/constants';
import type { RunResultsResponse, RunsListResponse } from '@/lib/types';

interface RefreshResult {
  inserted: number;
  skipped_duplicate: number;
  purged_legacy_fixture: number;
  source_errors: string[];
  counts_per_source: Record<string, number>;
  crawled_at: string;
}

const DEFAULT_FILTER: NewsFilterState = {
  sources: new Set(NEWS_SOURCES),
  sentiments: new Set(),
  ticker: null,
  dateRange: '30d',
  mockFailure: null,
};

export default function NewsPage() {
  const tNav = useTranslations('nav');
  const tNews = useTranslations('news');
  const tFilter = useTranslations('news.filter');

  const [filter, setFilter] = useState<NewsFilterState>({
    ...DEFAULT_FILTER,
    sources: new Set(NEWS_SOURCES),
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Force-reset infinite scroll whenever any filter changes by hashing the filter shape.
  const resetKey = useMemo(() => {
    const parts = [
      [...filter.sources].sort().join(','),
      [...filter.sentiments].sort().join(','),
      filter.ticker ?? '',
      filter.dateRange,
      filter.mockFailure ?? '',
    ];
    return parts.join('|');
  }, [filter]);
  const [resetCounter, setResetCounter] = useState(0);
  useEffect(() => {
    setResetCounter((c) => c + 1);
  }, [resetKey]);

  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await apiFetch<RefreshResult>('/api/news/refresh', { method: 'POST' });
      const errs = data.source_errors;
      const total = Object.values(data.counts_per_source).reduce((a, b) => a + b, 0);
      toast.push({
        kind: errs.length > 0 ? 'warning' : 'success',
        title: tNews('refresh.successTitle'),
        message: tNews('refresh.successMessage', { inserted: data.inserted, total }),
      });
      if (errs.length > 0) {
        toast.push({
          kind: 'warning',
          title: tNews('refresh.partialTitle'),
          message: errs.join(', '),
        });
      }
      // Reset infinite-scroll accumulator → refetch from /api/news with new data
      setResetCounter((c) => c + 1);
    } catch (e) {
      toast.push({
        kind: 'error',
        title: tNews('refresh.errorTitle'),
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const runsRes = useApiResource<RunsListResponse>('/api/runs?limit=1');
  const latestRunId = runsRes.data?.items[0]?.run_id ?? null;
  const resultsRes = useApiResource<RunResultsResponse>(
    latestRunId ? `/api/runs/${latestRunId}/results` : null,
  );
  const tickerOptions = useMemo(
    () =>
      (resultsRes.data?.results ?? [])
        .filter((row) => !row.ticker.startsWith('MOCK'))
        .map((row) => ({ ticker: row.ticker, name: row.name }))
        .sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [resultsRes.data],
  );
  const selectedTicker =
    filter.ticker && tickerOptions.some((option) => option.ticker === filter.ticker)
      ? filter.ticker
      : null;

  // Sentiment summary only when a valid ticker from the latest run is filtered.
  const { data: summary, loading: summaryLoading } = useSentimentSummary(selectedTicker);

  const arrayFilter = {
    sources: [...filter.sources],
    sentiments: [...filter.sentiments],
  };

  const filterPanel = (
    <NewsFilters
      state={filter}
      tickerOptions={tickerOptions}
      onChange={setFilter}
      onReset={() =>
        setFilter({
          ...DEFAULT_FILTER,
          sources: new Set(NEWS_SOURCES),
          sentiments: new Set(),
        })
      }
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {tNav('news')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost text-2xs px-2 py-1 inline-flex items-center gap-1"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={tNews('refresh.button')}
            data-testid="news-refresh-button"
          >
            <RefreshCw size={14} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? tNews('refresh.loading') : tNews('refresh.button')}
          </button>
          {/* Mobile drawer trigger */}
          <button
            type="button"
            className="btn btn-ghost text-2xs px-2 py-1 md:hidden inline-flex items-center gap-1"
            onClick={() => setDrawerOpen(true)}
            aria-label={tFilter('open')}
          >
            <Filter size={14} aria-hidden="true" />
            {tFilter('title')}
          </button>
        </div>
      </header>

      <InfoBanner
        testId="news-disclaimer"
        storageKey="news-disclaimer-v1"
        text={tNews('disclaimer')}
      />

      <div className="flex gap-4">
        {/* Desktop: sticky 320px filter panel */}
        <aside
          className="hidden md:block sticky top-4 self-start"
          style={{ width: 280, flexShrink: 0 }}
        >
          <div className="card p-3">{filterPanel}</div>
        </aside>

        {/* Right column: summary widget (if ticker) + list */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {selectedTicker && (
            <SentimentSummaryWidget
              ticker={selectedTicker}
              summary={summary}
              loading={summaryLoading}
            />
          )}

          <NewsList
            sources={arrayFilter.sources}
            sentiments={arrayFilter.sentiments}
            ticker={selectedTicker}
            dateRange={filter.dateRange}
            mockFailure={filter.mockFailure}
            resetKey={resetCounter}
          />
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ backgroundColor: 'var(--color-theme-overlay)' }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            className="fixed top-0 right-0 bottom-0 z-50 w-72 p-4 md:hidden flex flex-col gap-3 overflow-y-auto"
            style={{
              backgroundColor: 'var(--color-theme-secondary)',
              borderLeft: '1px solid var(--color-theme-charcoal)',
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
                {tFilter('title')}
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={tFilter('close')}
                className="opacity-70 hover:opacity-100"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            {filterPanel}
          </aside>
        </>
      )}
    </div>
  );
}
