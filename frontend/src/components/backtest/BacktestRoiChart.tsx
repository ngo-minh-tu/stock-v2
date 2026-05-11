'use client';

import { useTranslations } from 'next-intl';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { BacktestMetrics } from '@/lib/types';

interface Props {
  data: BacktestMetrics['roi_curve'];
}

export function BacktestRoiChart({ data }: Props) {
  const t = useTranslations('backtest.chart');

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-charcoal)" opacity={0.4} />
        <XAxis
          dataKey="week"
          tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 10 }}
          tickFormatter={(d: string) => d.slice(5)}
          stroke="var(--color-theme-charcoal)"
        />
        <YAxis
          tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 10 }}
          stroke="var(--color-theme-charcoal)"
          tickFormatter={(n: number) => `${n.toFixed(0)}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-theme-tooltip-background)',
            border: 'none',
            borderRadius: 4,
            color: 'var(--color-theme-text-tertiary)',
            fontSize: 12,
          }}
          formatter={(v: number) => `${v.toFixed(2)}%`}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--color-theme-text-primary)' }} />
        <Line
          type="monotone"
          dataKey="portfolio"
          name={t('portfolio')}
          stroke="var(--ssi-up)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="vnindex"
          name={t('vnindex')}
          stroke="var(--ssi-info, #009bde)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
