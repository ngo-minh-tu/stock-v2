'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Cell, Legend, Pie, PieChart as RPieChart, ResponsiveContainer } from 'recharts';

import type { Recommendation } from '@/lib/constants';

import { recommendationColor } from './ChartCard';

interface Datum {
  recommendation: Recommendation;
  count: number;
}

const RADIAN = Math.PI / 180;

interface LabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  value?: number;
  percent?: number;
}

export function PieChart({ data }: { data: Datum[] }) {
  const t = useTranslations('recommendation');
  const total = data.reduce((s, d) => s + d.count, 0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const items = data.map((d) => ({
    name: t(d.recommendation),
    value: d.count,
    rec: d.recommendation,
  }));
  const active = activeIndex !== null ? items[activeIndex] : null;
  const activePct = active && total > 0 ? Math.round((active.value / total) * 100) : 0;

  // Custom label so we can set theme-aware fill (default recharts label uses
  // a hardcoded dark fill that disappears on OLED / classic-dark backgrounds).
  const renderLabel = (props: LabelProps) => {
    const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, value, percent } = props;
    if (typeof value !== 'number' || total === 0) return null;
    const pct = typeof percent === 'number' ? percent : value / total;
    if (pct < 0.04) return null; // hide labels for very small slices to avoid overlap
    const radius = outerRadius + 14;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
        fill="var(--color-theme-text-tertiary)"
      >
        {`${Math.round(pct * 100)}%`}
      </text>
    );
  };

  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RPieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            innerRadius="50%"
            outerRadius="72%"
            paddingAngle={2}
            label={renderLabel}
            labelLine={false}
            isAnimationActive={false}
            onMouseEnter={(_, idx) => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {items.map((d) => (
              <Cell
                key={d.rec}
                fill={recommendationColor(d.rec)}
                stroke="var(--color-theme-card-bg)"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={24}
            formatter={(value) => (
              <span style={{ color: 'var(--color-theme-text-tertiary)', fontSize: 12 }}>{value}</span>
            )}
          />
        </RPieChart>
      </ResponsiveContainer>

      {/* Center label — sits inside the donut hole. Replaces the recharts Tooltip
          popup (which used to overlap the colored ring on hover). pointer-events-none
          so it never blocks slice hover detection underneath. */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ paddingBottom: 24 /* offset for legend at bottom */ }}
      >
        {active ? (
          <div
            className="flex flex-col items-center"
            style={{ color: recommendationColor(active.rec) }}
          >
            <span className="text-xs font-medium">{active.name}</span>
            <span className="text-2xl font-bold leading-tight">{active.value}</span>
            <span className="text-2xs" style={{ opacity: 0.85 }}>
              {activePct}% · trên {total} mã
            </span>
          </div>
        ) : (
          <>
            <span
              className="text-2xs uppercase tracking-wider"
              style={{ color: 'var(--color-theme-text-secondary)' }}
            >
              Tổng
            </span>
            <span
              className="text-2xl font-bold leading-tight"
              style={{ color: 'var(--color-theme-text-tertiary)' }}
            >
              {total}
            </span>
            <span
              className="text-2xs"
              style={{ color: 'var(--color-theme-text-secondary)' }}
            >
              mã
            </span>
          </>
        )}
      </div>
    </div>
  );
}
