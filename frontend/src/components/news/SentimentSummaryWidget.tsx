'use client';

// Sentiment summary widget — renders only when a single ticker filter is active
// (cluster prompt §5). Shows count, avg score, source breakdown bar.
//
// Doughnut implemented as a CSS conic-gradient — no chart library to keep cluster 4 lean.

import { useTranslations } from 'next-intl';

import {
  NEWS_SOURCES,
  SENTIMENT_LABELS,
  type NewsSourceKey,
  type SentimentLabelKey,
} from '@/lib/constants';
import type { SentimentSummaryResponse } from '@/lib/types';

import { SENTIMENT_BORDER_TINT, SentimentChip } from './SentimentChip';

interface Props {
  ticker: string;
  summary: SentimentSummaryResponse | null;
  loading: boolean;
}

const SLICE_TOKEN: Record<SentimentLabelKey, string> = {
  POSITIVE: 'var(--ssi-up)',
  NEUTRAL:  'var(--ssi-stable)',
  NEGATIVE: 'var(--ssi-down)',
};

const SOURCE_TINT: Record<NewsSourceKey, string> = {
  CAFEF: '#d32f2f',
  VNEXPRESS: '#1769aa',
  VIETSTOCK: '#2e7d32',
  BATDONGSAN: '#e64a19',
  THANHNIEN: '#5d4037',
};

function normalizedSummary(summary: SentimentSummaryResponse) {
  const total = summary.count ?? summary.total ?? 0;
  const score = summary.score ?? summary.score_avg ?? 0;
  const label: SentimentLabelKey =
    summary.label ?? (score >= 0.2 ? 'POSITIVE' : score <= -0.2 ? 'NEGATIVE' : 'NEUTRAL');
  const breakdown = summary.breakdown ?? SENTIMENT_LABELS.map((itemLabel) => ({
    label: itemLabel,
    count: summary.label_counts?.[itemLabel] ?? 0,
  }));
  const rawSourceBreakdown = summary.source_breakdown;
  const source_breakdown = Array.isArray(rawSourceBreakdown)
    ? rawSourceBreakdown
    : NEWS_SOURCES.map((source) => ({
        source,
        count: rawSourceBreakdown[source] ?? 0,
      }));

  return { total, score, label, breakdown, source_breakdown };
}

function buildConic(summary: ReturnType<typeof normalizedSummary>): string {
  const total = summary.total;
  if (total === 0) return `var(--ssi-stable)`;
  let acc = 0;
  const segments: string[] = [];
  for (const label of SENTIMENT_LABELS) {
    const item = summary.breakdown.find((b) => b.label === label);
    const n = item?.count ?? 0;
    if (n === 0) continue;
    const start = (acc / total) * 360;
    const end = ((acc + n) / total) * 360;
    segments.push(`${SLICE_TOKEN[label]} ${start}deg ${end}deg`);
    acc += n;
  }
  return `conic-gradient(${segments.join(', ')})`;
}

export function SentimentSummaryWidget({ ticker, summary, loading }: Props) {
  const t = useTranslations('news.summary');
  const tSource = useTranslations('news.source');

  if (loading || !summary) {
    return (
      <div className="card p-3 text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {t('title', { ticker })} — …
      </div>
    );
  }

  const normalized = normalizedSummary(summary);
  const conic = buildConic(normalized);
  const noData = normalized.total === 0;

  return (
    <div className="card p-3 flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('title', { ticker })}
        </h3>
        <SentimentChip label={normalized.label} score={normalized.score} size="md" />
      </header>

      {noData ? (
        <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('noData')}
        </p>
      ) : (
        <div className="flex items-center gap-4">
          {/* Doughnut */}
          <div
            aria-hidden="true"
            className="rounded-full relative"
            style={{
              width: 84,
              height: 84,
              background: conic,
              flexShrink: 0,
            }}
          >
            <div
              className="absolute inset-2 rounded-full flex flex-col items-center justify-center"
              style={{ backgroundColor: 'var(--color-theme-card-bg)' }}
            >
              <span className="text-md font-semibold" style={{ color: 'var(--color-theme-text-tertiary)' }}>
                {normalized.score >= 0 ? '+' : ''}
                {normalized.score.toFixed(2)}
              </span>
              <span className="text-3xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
                {t('scoreAvg')}
              </span>
            </div>
          </div>

          {/* Legend + count */}
          <div className="flex flex-col gap-1 text-2xs">
            <span style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('count', { n: normalized.total })}
            </span>
            {SENTIMENT_LABELS.map((label) => {
              const item = normalized.breakdown.find((b) => b.label === label);
              const n = item?.count ?? 0;
              return (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: SENTIMENT_BORDER_TINT[label] }}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                  <span className="ml-auto tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Source breakdown — mini horizontal bar */}
      {!noData && (
        <div className="flex flex-col gap-1 text-3xs">
          <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('sourceBreakdown')}</span>
          <div className="flex h-2 rounded overflow-hidden">
            {NEWS_SOURCES.map((s) => {
              const item = normalized.source_breakdown.find((b) => b.source === s);
              const n = item?.count ?? 0;
              if (n === 0) return null;
              const pct = (n / normalized.total) * 100;
              return (
                <div
                  key={s}
                  title={`${tSource(s)}: ${n}`}
                  style={{ width: `${pct}%`, backgroundColor: SOURCE_TINT[s] }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
