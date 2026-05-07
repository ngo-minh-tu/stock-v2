'use client';

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { Recommendation } from '@/lib/constants';

import { recommendationColor } from './ChartCard';

interface Datum {
  ticker: string;
  ai_score: number;
  recommendation: Recommendation;
}

export function BarChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RBarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-charcoal)" opacity={0.4} />
        <XAxis
          dataKey="ticker"
          tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 10 }}
          stroke="var(--color-theme-charcoal)"
        />
        <YAxis
          tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 10 }}
          stroke="var(--color-theme-charcoal)"
          domain={[0, 100]}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-theme-tertiary)', opacity: 0.4 }}
          contentStyle={{
            backgroundColor: 'var(--color-theme-tooltip-background)',
            border: 'none',
            borderRadius: 4,
            color: 'var(--color-theme-text-tertiary)',
            fontSize: 12,
          }}
        />
        <Bar dataKey="ai_score" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.ticker} fill={recommendationColor(d.recommendation)} />
          ))}
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  );
}
