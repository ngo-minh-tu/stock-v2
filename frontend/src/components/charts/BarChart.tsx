'use client';

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslations } from 'next-intl';

import type { Recommendation } from '@/lib/constants';

import { recommendationColor } from './ChartCard';
import { ResponsiveChart } from './ResponsiveChart';

interface Datum {
  ticker: string;
  ai_score: number;
  recommendation: Recommendation;
}

interface TooltipPayload {
  payload?: Datum;
}

function TopAiScoreTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  const tReco = useTranslations('recommendation');
  const t = useTranslations('dashboard.chart.bar.tooltip');
  if (!active || !payload?.length || !payload[0].payload) return null;

  const item = payload[0].payload;
  return (
    <div
      className="rounded-md shadow-lg text-xs"
      style={{
        padding: '10px 12px',
        backgroundColor: 'var(--color-theme-tooltip-background)',
        border: '1px solid var(--color-theme-tooltip-border)',
        color: 'var(--color-theme-text-tertiary)',
        backdropFilter: 'blur(2px)',
        minWidth: 150,
      }}
    >
      <div className="font-bold text-sm mb-1">{item.ticker}</div>
      <div className="flex items-center justify-between gap-4">
        <span style={{ color: 'var(--color-theme-text-secondary)' }}>AI Score</span>
        <span className="font-semibold tabular-nums">{item.ai_score.toFixed(2)}/100</span>
      </div>
      <div className="flex items-center justify-between gap-4 mt-0.5">
        <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('recommendation')}</span>
        <span className="font-semibold" style={{ color: recommendationColor(item.recommendation) }}>
          {tReco(item.recommendation)}
        </span>
      </div>
    </div>
  );
}

export function BarChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveChart>
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
          isAnimationActive={false}
          animationDuration={0}
          cursor={{ fill: 'var(--color-theme-tertiary)', opacity: 0.4 }}
          content={<TopAiScoreTooltip />}
          wrapperStyle={{ transition: 'none', pointerEvents: 'none' }}
        />
        <Bar dataKey="ai_score" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.ticker} fill={recommendationColor(d.recommendation)} />
          ))}
        </Bar>
      </RBarChart>
    </ResponsiveChart>
  );
}
