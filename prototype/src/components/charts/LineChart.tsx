'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Point {
  date: string;
  vnindex: number;
  sector: number;
}

export function LineChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RLineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-charcoal)" opacity={0.4} />
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 10 }}
          tickFormatter={(d: string) => d.slice(5)}
          stroke="var(--color-theme-charcoal)"
        />
        <YAxis
          tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 10 }}
          stroke="var(--color-theme-charcoal)"
          domain={['dataMin - 50', 'dataMax + 50']}
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
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'var(--color-theme-text-primary)' }}
        />
        <Line
          type="monotone"
          dataKey="vnindex"
          name="VN-Index"
          stroke="var(--ssi-up)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="sector"
          name="BĐS Index"
          stroke="var(--ssi-info, #009bde)"
          strokeWidth={2}
          dot={false}
        />
      </RLineChart>
    </ResponsiveContainer>
  );
}
