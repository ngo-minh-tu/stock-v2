'use client';

import { Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ChartCard } from '@/components/charts/ChartCard';
import type { CompareResponse } from '@/lib/types';

import { CompareSummary } from './CompareSummary';
import { NewRemovedSection } from './NewRemovedSection';
import { RecommendationChangesTable } from './RecommendationChangesTable';
import { ScoreHistogram } from './ScoreHistogram';

interface Props {
  data: CompareResponse | null;
  loading: boolean;
  error: Error | { message: string } | null;
  hint: string | null; // shown when only A is selected, or both empty
  onClear: () => void;
}

export function ComparePanel({ data, loading, error, hint, onClear }: Props) {
  const t = useTranslations('runHistory.compare');

  if (hint) {
    return (
      <aside className="card p-4 flex flex-col gap-2">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('panelTitle')}
        </h3>
        <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {hint}
        </p>
      </aside>
    );
  }

  return (
    <aside className="card p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('panelTitle')}
          </h3>
          {data && (
            <p className="text-3xs mt-0.5" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('panelSubtitle', {
                a: data.run_a.run_id,
                b: data.run_b.run_id,
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1 opacity-70 hover:opacity-100"
          aria-label={t('clear')}
          title={t('clear')}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          {t('loading')}
        </div>
      )}

      {error && !loading && (
        <p className="text-2xs" style={{ color: 'var(--ssi-down)' }}>
          {(error as Error).message ?? t('error')}
        </p>
      )}

      {data && !loading && (
        <>
          <section className="flex flex-col gap-2">
            <h4
              className="text-2xs uppercase tracking-wide"
              style={{ color: 'var(--color-theme-text-secondary)' }}
            >
              {t('summary')}
            </h4>
            <CompareSummary diff={data.summary_diff} />
          </section>

          <section className="flex flex-col gap-2">
            <h4
              className="text-2xs uppercase tracking-wide"
              style={{ color: 'var(--color-theme-text-secondary)' }}
            >
              {t('changes')}
            </h4>
            <p className="text-3xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('legend')}
            </p>
            <RecommendationChangesTable rows={data.recommendation_changes} />
          </section>

          <section className="flex flex-col gap-2">
            <h4
              className="text-2xs uppercase tracking-wide"
              style={{ color: 'var(--color-theme-text-secondary)' }}
            >
              {t('newRemoved')}
            </h4>
            <NewRemovedSection newEntries={data.new_entries} removed={data.removed} />
          </section>

          <ChartCard title={t('distribution')} subtitle={t('distributionSubtitle')} height={220}>
            <ScoreHistogram data={data.score_distribution} />
          </ChartCard>
        </>
      )}
    </aside>
  );
}
