'use client';

import { Filter, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { NewsFilters, type NewsFilterState } from '@/components/news/NewsFilters';
import { NewsList } from '@/components/news/NewsList';
import { SentimentSummaryWidget } from '@/components/news/SentimentSummaryWidget';
import { useSentimentSummary } from '@/lib/hooks/useStocks';
import { NEWS_SOURCES } from '@/lib/constants';

const DEFAULT_FILTER: NewsFilterState = {
  sources: new Set(NEWS_SOURCES),
  sentiments: new Set(),
  ticker: null,
  dateRange: '30d',
  mockFailure: null,
};

export default function NewsPage() {
  const tNav = useTranslations('nav');
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

  // Sentiment summary only when a single ticker is filtered (cluster prompt §5).
  const { data: summary, loading: summaryLoading } = useSentimentSummary(filter.ticker);

  const arrayFilter = {
    sources: [...filter.sources],
    sentiments: [...filter.sentiments],
  };

  const filterPanel = (
    <NewsFilters
      state={filter}
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
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {tNav('news')}
        </h1>
        {/* Mobile drawer trigger */}
        <button
          type="button"
          className="btn btn-ghost text-2xs px-2 py-1 md:hidden"
          onClick={() => setDrawerOpen(true)}
          aria-label={tFilter('open')}
        >
          <Filter size={14} aria-hidden="true" />
          {tFilter('title')}
        </button>
      </header>

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
          {filter.ticker && (
            <SentimentSummaryWidget
              ticker={filter.ticker}
              summary={summary}
              loading={summaryLoading}
            />
          )}

          <NewsList
            sources={arrayFilter.sources}
            sentiments={arrayFilter.sentiments}
            ticker={filter.ticker}
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
