'use client';

// Allocation card — VND amount + weight %. Hidden behind "Bỏ qua phân bổ" if total_capital=0.

import { useTranslations } from 'next-intl';

import type { Recommendation } from '@/lib/constants';

interface Props {
  allocationAmount?: number;
  allocationWeight?: number;
  totalCapital: number;
  recommendation: Recommendation;
}

export function AllocationCard({
  allocationAmount,
  allocationWeight,
  totalCapital,
  recommendation,
}: Props) {
  const t = useTranslations('stockDetail.risk.allocation');
  const tRecommendation = useTranslations('recommendation');
  const hasAllocation =
    typeof allocationAmount === 'number' &&
    allocationAmount > 0 &&
    typeof allocationWeight === 'number';

  if (!hasAllocation) {
    const message =
      totalCapital > 0 && recommendation !== 'MUA'
        ? t('notBuy', {
            recommendation: tRecommendation(recommendation),
            total: totalCapital.toLocaleString('fr-FR'),
          })
        : t('skipped');

    return (
      <div className="card p-4 flex flex-col gap-2">
        <h3
          className="text-2xs uppercase tracking-wider"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          {t('title')}
        </h3>
        <span className="text-base" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {message}
        </span>
      </div>
    );
  }
  return (
    <div className="card p-4 flex flex-col gap-2">
      <h3 className="text-2xs uppercase tracking-wider" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {t('title')}
      </h3>
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color: 'var(--color-theme-text-tertiary)' }}
      >
        {allocationAmount.toLocaleString('fr-FR')}
        <span className="text-sm font-medium ml-1">VND</span>
      </span>
      <span className="text-xs" style={{ color: 'var(--color-theme-text-primary)' }}>
        {t('weight', { pct: (allocationWeight * 100).toFixed(1) })}
      </span>
      <span className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {t('basedOn', { total: totalCapital.toLocaleString('fr-FR') })}
      </span>
    </div>
  );
}
