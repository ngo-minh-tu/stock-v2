'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { NewsCard } from './NewsCard';
import { useNews } from '@/lib/hooks/useStocks';
import type { NewsArticle, NewsListResponse } from '@/lib/types';
import {
  type NewsDateRange,
  type NewsSourceKey,
  type SentimentLabelKey,
} from '@/lib/constants';

interface Props {
  sources: NewsSourceKey[];
  sentiments: SentimentLabelKey[];
  ticker: string | null;
  dateRange: NewsDateRange;
  mockFailure: NewsSourceKey | null;
  /** Reset signal: incrementing this number resets the pagination. */
  resetKey: number;
}

const PAGE_SIZE = 20;

export function NewsList({
  sources,
  sentiments,
  ticker,
  dateRange,
  mockFailure,
  resetKey,
}: Props) {
  const t = useTranslations('news');
  const tSource = useTranslations('news.source');

  // Page count = how many pages have been requested (1-based). When filters change → reset to 1.
  const [pageCount, setPageCount] = useState(1);
  const [accumulator, setAccumulator] = useState<NewsArticle[]>([]);
  const [lastResponse, setLastResponse] = useState<NewsListResponse | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset on filter change.
  useEffect(() => {
    setPageCount(1);
    setAccumulator([]);
    setLastResponse(null);
  }, [resetKey]);

  // Fetch the latest page only.
  const offset = (pageCount - 1) * PAGE_SIZE;
  const { data, error, loading } = useNews({
    sources,
    sentiments,
    ticker,
    dateRange,
    limit: PAGE_SIZE,
    offset,
    mockFailure: mockFailure ? mockFailure.toLowerCase() : null,
  });

  // Append page when it arrives.
  useEffect(() => {
    if (!data) return;
    setLastResponse(data);
    setAccumulator((prev) => {
      // First page replaces; later pages append (de-dup by article_id).
      if (data.offset === 0) return data.items;
      const seen = new Set(prev.map((a) => a.article_id));
      const merged = [...prev];
      for (const a of data.items) if (!seen.has(a.article_id)) merged.push(a);
      return merged;
    });
  }, [data]);

  // Infinite scroll: bump pageCount when sentinel enters viewport (200px below bottom).
  // CRITICAL: skip while a fetch is in flight, otherwise a fast scroll fires the observer
  // again before the in-flight page returns. useApiResource cancels the prior request when
  // path changes (offset N → offset N+20), so the canceled page's data never lands in the
  // accumulator and the user sees a gap of 20 missing articles.
  useEffect(() => {
    if (loading) return;
    const node = sentinelRef.current;
    if (!node) return;
    if (!lastResponse) return;
    const reachedEnd = accumulator.length >= lastResponse.total;
    if (reachedEnd) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPageCount((p) => p + 1);
        }
      },
      { rootMargin: '200px 0px 200px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [accumulator.length, lastResponse, loading]);

  if (loading && accumulator.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="card p-3"
            style={{ minHeight: 80, opacity: 0.5 - i * 0.07, backgroundColor: 'var(--color-theme-tertiary)' }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-4 text-sm" style={{ color: 'var(--ssi-down)' }}>
        {t('errorLoad')}
      </div>
    );
  }

  if (accumulator.length === 0) {
    return (
      <div className="card p-6 text-center text-sm">
        <p style={{ color: 'var(--color-theme-text-tertiary)' }}>{t('empty.30days')}</p>
        <p
          className="text-2xs mt-1"
          style={{ color: 'var(--color-theme-text-secondary)' }}
          aria-hidden="true"
        >
          ☷
        </p>
      </div>
    );
  }

  const reachedEnd = lastResponse ? accumulator.length >= lastResponse.total : false;

  return (
    <div className="flex flex-col gap-3">
      {lastResponse?.source_errors.length ? (
        <div
          role="alert"
          className="card p-3 text-2xs"
          style={{
            color: 'var(--color-theme-text-tertiary)',
            borderLeft: '3px solid var(--ssi-down)',
            backgroundColor: 'rgba(255,0,23,0.08)',
          }}
        >
          {lastResponse.source_errors
            .map((s) => t('sourceError', { source: tSource(s) }))
            .join(' ')}
        </div>
      ) : null}

      {accumulator.map((article) => (
        <NewsCard key={article.article_id} article={article} />
      ))}

      <div ref={sentinelRef} className="h-1" aria-hidden="true" />

      {loading && accumulator.length > 0 && (
        <div
          className="flex items-center gap-2 text-2xs"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          {t('load.loading')}
        </div>
      )}

      {reachedEnd && (
        <p className="text-3xs text-center" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('load.end')}
        </p>
      )}
    </div>
  );
}
