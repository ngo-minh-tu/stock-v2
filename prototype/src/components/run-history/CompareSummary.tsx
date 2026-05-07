'use client';

import { useTranslations } from 'next-intl';

import type { CompareSummaryDiff } from '@/lib/types';

interface Props {
  diff: CompareSummaryDiff;
}

interface Row {
  metric: string;
  a: number;
  b: number;
  format?: 'int' | 'sec' | 'float';
  /** When true, +Δ is colored green; when false (e.g. duration), +Δ is red. */
  positiveIsGood?: boolean;
}

function fmt(n: number, format?: Row['format']): string {
  if (format === 'sec') {
    if (n < 60) return `${n}s`;
    const m = Math.floor(n / 60);
    const s = n - m * 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (format === 'float') return n.toFixed(1);
  return String(n);
}

export function CompareSummary({ diff }: Props) {
  const tMetric = useTranslations('runHistory.compare.metric');
  const tHeader = useTranslations('runHistory.compare.header');

  const rows: Row[] = [
    { metric: tMetric('totalScored'), a: diff.total_scored.a, b: diff.total_scored.b, format: 'int', positiveIsGood: true },
    { metric: tMetric('buyCount'), a: diff.buy_count.a, b: diff.buy_count.b, format: 'int', positiveIsGood: true },
    { metric: tMetric('holdCount'), a: diff.hold_count.a, b: diff.hold_count.b, format: 'int' },
    { metric: tMetric('sellCount'), a: diff.sell_count.a, b: diff.sell_count.b, format: 'int', positiveIsGood: false },
    { metric: tMetric('avgScore'), a: diff.avg_score.a, b: diff.avg_score.b, format: 'float', positiveIsGood: true },
    { metric: tMetric('duration'), a: diff.duration_seconds.a, b: diff.duration_seconds.b, format: 'sec', positiveIsGood: false },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-2xs">
        <thead style={{ borderBottom: '1px solid var(--color-theme-charcoal)' }}>
          <tr>
            <th className="text-left py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {tHeader('metric')}
            </th>
            <th className="text-right py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {tHeader('runA')}
            </th>
            <th className="text-right py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {tHeader('runB')}
            </th>
            <th className="text-right py-1.5 font-medium" style={{ color: 'var(--color-theme-text-secondary)' }}>
              Δ
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const delta = r.b - r.a;
            const isNeutralColor = r.positiveIsGood === undefined || delta === 0;
            const goodSign = r.positiveIsGood ? Math.sign(delta) : -Math.sign(delta);
            const color = isNeutralColor
              ? 'var(--color-theme-text-secondary)'
              : goodSign > 0
                ? 'var(--ssi-up)'
                : 'var(--ssi-down)';
            const deltaStr =
              r.format === 'float'
                ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`
                : r.format === 'sec'
                  ? `${delta > 0 ? '+' : ''}${delta}s`
                  : `${delta > 0 ? '+' : ''}${delta}`;
            return (
              <tr key={r.metric} style={{ borderBottom: '1px solid var(--color-theme-table-border)' }}>
                <td className="py-1.5">{r.metric}</td>
                <td className="text-right tabular-nums">{fmt(r.a, r.format)}</td>
                <td className="text-right tabular-nums">{fmt(r.b, r.format)}</td>
                <td className="text-right tabular-nums" style={{ color }}>
                  {delta === 0 ? '0' : deltaStr}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
