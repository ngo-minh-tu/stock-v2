'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ChartCard } from '@/components/charts/ChartCard';
import type { BacktestMetrics, BacktestResultRow } from '@/lib/types';

import { BacktestDetailTable } from './BacktestDetailTable';
import { BacktestRoiChart } from './BacktestRoiChart';

interface Props {
  metrics: BacktestMetrics;
  results: BacktestResultRow[];
}

const ACCURACY_THRESHOLD = 0.60;

function MetricCell({
  label,
  value,
  hint,
  color,
  large,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <div className="card p-3 flex flex-col gap-1.5 min-w-0">
      <span
        className="text-2xs uppercase tracking-wide"
        style={{ color: 'var(--color-theme-text-secondary)' }}
      >
        {label}
      </span>
      <span
        className={`${large ? 'text-3xl' : 'text-xl'} font-bold leading-tight tabular-nums truncate`}
        style={{ color: color ?? 'var(--color-theme-text-tertiary)' }}
      >
        {value}
      </span>
      {hint && (
        <span className="text-2xs truncate" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function BacktestResultCard({ metrics, results }: Props) {
  const t = useTranslations('backtest.metric');
  const tCard = useTranslations('backtest.card');

  const [expanded, setExpanded] = useState(false);

  const accuracyColor =
    metrics.recommendation_accuracy >= ACCURACY_THRESHOLD ? 'var(--ssi-up)' : 'var(--ssi-down)';
  const alphaColor =
    metrics.alpha > 0 ? 'var(--ssi-up)' : metrics.alpha < 0 ? 'var(--ssi-down)' : 'var(--ssi-stable)';

  return (
    <section className="card p-4 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {tCard('title', { id: metrics.backtest_id })}
          </h3>
          <p className="text-2xs mt-0.5" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {tCard('range', {
              from: metrics.period_from,
              to: metrics.period_to,
              total: metrics.total_count,
              correct: metrics.correct_count,
            })}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCell
          label={t('accuracy')}
          value={`${(metrics.recommendation_accuracy * 100).toFixed(1)}%`}
          hint={tCard('accuracyHint', { threshold: '60' })}
          color={accuracyColor}
          large
        />
        <MetricCell
          label={t('priceError')}
          value={`${metrics.price_error_mean.toFixed(1)}%`}
        />
        <MetricCell
          label={t('portfolioRoi')}
          value={`${metrics.portfolio_roi > 0 ? '+' : ''}${metrics.portfolio_roi.toFixed(1)}%`}
          hint={`${t('vnindexRoi')}: ${metrics.vnindex_roi > 0 ? '+' : ''}${metrics.vnindex_roi.toFixed(1)}%`}
          color={metrics.portfolio_roi > 0 ? 'var(--ssi-up)' : 'var(--ssi-down)'}
        />
        <MetricCell
          label={t('alpha')}
          value={`${metrics.alpha > 0 ? '+' : ''}${metrics.alpha.toFixed(1)}%`}
          hint={tCard('alphaHint')}
          color={alphaColor}
        />
      </div>

      <ChartCard title={tCard('chartTitle')} subtitle={tCard('chartSubtitle')} height={240}>
        <BacktestRoiChart data={metrics.roi_curve} />
      </ChartCard>

      <button
        type="button"
        className="btn btn-ghost self-start text-2xs"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown size={14} aria-hidden="true" />
        ) : (
          <ChevronRight size={14} aria-hidden="true" />
        )}
        {expanded ? tCard('hideDetail') : tCard('showDetail', { count: results.length })}
      </button>

      {expanded && <BacktestDetailTable rows={results} />}
    </section>
  );
}
