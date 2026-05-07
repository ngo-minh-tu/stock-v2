'use client';

// Allocation card — VND amount + weight %. Hidden behind "Bỏ qua phân bổ" if total_capital=0.

import { useTranslations } from 'next-intl';

interface Props {
  allocationAmount: number;
  allocationWeight: number;
  totalCapital: number;
}

export function AllocationCard({ allocationAmount, allocationWeight, totalCapital }: Props) {
  const t = useTranslations('stockDetail.risk.allocation');
  if (totalCapital <= 0 || allocationAmount <= 0) {
    return (
      <div className="card p-4 flex flex-col gap-2">
        <h3
          className="text-2xs uppercase tracking-wider"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          {t('title')}
        </h3>
        <span className="text-base" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('skipped')}
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
