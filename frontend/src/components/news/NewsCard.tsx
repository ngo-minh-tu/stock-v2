'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { SENTIMENT_BORDER_TINT, SentimentChip } from '@/components/news/SentimentChip';
import { SourceLogo } from '@/components/common/SourceLogo';
import type { NewsArticle } from '@/lib/types';

interface Props {
  article: NewsArticle;
}

type TimeT = (key: string, values?: Record<string, number>) => string;

function relativeTime(iso: string | null, t: TimeT): string {
  if (!iso) return t('unknown');
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return t('unknown');
  const diffMs = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (minutes < 1) return t('justNow');
  if (hours < 1) return t('minutesAgo', { n: minutes });
  if (days < 1) return t('hoursAgo', { n: hours });
  return t('daysAgo', { n: days });
}

export function NewsCard({ article }: Props) {
  const t = useTranslations('news');
  const tSource = useTranslations('news.source');
  const tTime = useTranslations('news.time');
  const router = useRouter();
  const borderColor = SENTIMENT_BORDER_TINT[article.sentiment_label];

  return (
    <article
      className="card flex flex-col gap-2 p-3"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <header className="flex items-center gap-2 text-2xs">
        <SourceLogo source={article.source} size="sm" />
        <span style={{ color: 'var(--color-theme-text-tertiary)' }} className="font-medium">
          {tSource(article.source)}
        </span>
        <span aria-hidden="true" style={{ color: 'var(--color-theme-text-secondary)' }}>
          ·
        </span>
        <time
          dateTime={article.published_at ?? undefined}
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          {relativeTime(article.published_at, tTime as TimeT)}
        </time>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('card.openExternal')}
          className="ml-auto opacity-70 hover:opacity-100"
        >
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </header>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-md font-medium leading-tight hover:underline"
        style={{ color: 'var(--color-theme-text-tertiary)' }}
      >
        {article.title}
      </a>

      <p
        className="text-2xs"
        style={{
          color: 'var(--color-theme-text-secondary)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {article.content_snippet}
      </p>

      <footer className="flex flex-wrap items-center gap-2">
        <SentimentChip label={article.sentiment_label} score={article.sentiment_score} />
        {article.related_tickers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {article.related_tickers.map((tkr) => (
              <button
                key={tkr}
                type="button"
                onClick={() =>
                  router.push(`/stock-detail?ticker=${encodeURIComponent(tkr)}`)
                }
                className="px-1.5 py-0.5 rounded text-3xs border hover:underline"
                style={{
                  color: 'var(--color-theme-text-secondary)',
                  borderColor: 'var(--color-theme-charcoal)',
                }}
              >
                {tkr}
              </button>
            ))}
          </div>
        )}
        {article.sentiment_reason === 'unavailable' ? (
          <span
            className="text-3xs italic ml-auto"
            style={{ color: 'var(--color-theme-text-secondary)' }}
            title="GUARD-08: sentiment_reason unavailable"
          >
            unavailable
          </span>
        ) : null}
      </footer>
    </article>
  );
}
