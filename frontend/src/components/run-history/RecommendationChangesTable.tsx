'use client';

import { useTranslations } from 'next-intl';

import { RecommendationBadge } from '@/components/badges/RecommendationBadge';
import type { CompareRecommendationChange } from '@/lib/types';

interface Props {
  rows: CompareRecommendationChange[];
}

export function RecommendationChangesTable({ rows }: Props) {
  const t = useTranslations('runHistory.compare');

  if (rows.length === 0) {
    return (
      <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {t('changesEmpty')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-2xs">
        <thead style={{ borderBottom: '1px solid var(--color-theme-charcoal)' }}>
          <tr>
            <th className="text-left py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('changesColumn.ticker')}
            </th>
            <th className="text-center py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('changesColumn.recA')}
            </th>
            <th className="text-center py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('changesColumn.recB')}
            </th>
            <th className="text-right py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('changesColumn.scoreA')}
            </th>
            <th className="text-right py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('changesColumn.scoreB')}
            </th>
            <th className="text-right py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              Δ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const bg =
              r.direction === 'upgrade'
                ? 'rgba(0, 192, 135, 0.10)'
                : r.direction === 'downgrade'
                  ? 'rgba(241, 81, 87, 0.10)'
                  : 'transparent';
            const deltaColor =
              r.delta > 0 ? 'var(--ssi-up)' : r.delta < 0 ? 'var(--ssi-down)' : 'var(--ssi-stable)';
            return (
              <tr
                key={r.ticker}
                style={{
                  backgroundColor: bg,
                  borderBottom: '1px solid var(--color-theme-table-border)',
                }}
              >
                <td className="py-1.5 px-2">
                  <span className="font-bold">{r.ticker}</span>
                  <span
                    className="ml-1.5 text-3xs truncate"
                    style={{ color: 'var(--color-theme-text-secondary)' }}
                    title={r.name}
                  >
                    {r.name}
                  </span>
                </td>
                <td className="text-center">
                  <RecommendationBadge value={r.rec_a} size="sm" />
                </td>
                <td className="text-center">
                  <RecommendationBadge value={r.rec_b} size="sm" />
                </td>
                <td className="text-right tabular-nums">{r.score_a}</td>
                <td className="text-right tabular-nums">{r.score_b}</td>
                <td className="text-right tabular-nums" style={{ color: deltaColor }}>
                  {r.delta > 0 ? '+' : ''}{r.delta}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
