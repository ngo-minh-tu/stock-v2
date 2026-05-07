'use client';

import { useTranslations } from 'next-intl';
import { Cell, Legend, Pie, PieChart as RPieChart, ResponsiveContainer, Tooltip } from 'recharts';

import type { Recommendation } from '@/lib/constants';

import { recommendationColor } from './ChartCard';

interface Datum {
  recommendation: Recommendation;
  count: number;
}

export function PieChart({ data }: { data: Datum[] }) {
  const t = useTranslations('recommendation');
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RPieChart>
        <Pie
          data={data.map((d) => ({ name: t(d.recommendation), value: d.count, rec: d.recommendation }))}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          label={({ value }: { value?: number }) =>
            total > 0 && typeof value === 'number'
              ? `${Math.round((value / total) * 100)}%`
              : ''
          }
          labelLine={false}
        >
          {data.map((d) => (
            <Cell
              key={d.recommendation}
              fill={recommendationColor(d.recommendation)}
              stroke="var(--color-theme-card-bg)"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-theme-tooltip-background)',
            border: 'none',
            borderRadius: 4,
            color: 'var(--color-theme-text-tertiary)',
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={24}
          formatter={(value) => (
            <span style={{ color: 'var(--color-theme-text-primary)', fontSize: 12 }}>{value}</span>
          )}
        />
      </RPieChart>
    </ResponsiveContainer>
  );
}
