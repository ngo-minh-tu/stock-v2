'use client';

import { useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ResponsiveChart } from '@/components/charts/ResponsiveChart';
import type { CompareDistributionBucket } from '@/lib/types';

interface Props {
  data: CompareDistributionBucket[];
}

export function ScoreHistogram({ data }: Props) {
  const t = useTranslations('runHistory.compare.histogram');

  return (
    <ResponsiveChart>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-charcoal)" opacity={0.4} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 10 }}
          stroke="var(--color-theme-charcoal)"
        />
        <YAxis
          tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 10 }}
          stroke="var(--color-theme-charcoal)"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-theme-tooltip-background)',
            border: 'none',
            borderRadius: 4,
            color: 'var(--color-theme-text-tertiary)',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-theme-text-primary)' }} />
        <Bar dataKey="a_count" name={t('runA')} fill="var(--ssi-up)" />
        <Bar dataKey="b_count" name={t('runB')} fill="var(--ssi-info, #009bde)" />
      </BarChart>
    </ResponsiveChart>
  );
}
