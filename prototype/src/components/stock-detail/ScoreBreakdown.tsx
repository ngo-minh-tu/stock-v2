'use client';

// Radar 5 nhóm + (optional) industry-average overlay. Inline because the cluster-2 RadarChart
// is shaped for a single dataset; this one needs two series.

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RRadarChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

import { FeatureTable } from './FeatureTable';
import type { StockDetailResponse } from '@/lib/types';

interface Props {
  detail: StockDetailResponse;
}

export function ScoreBreakdown({ detail }: Props) {
  const t = useTranslations('stockDetail.breakdown');
  const tGroup = useTranslations('stockDetail.feature.group');
  const [showFeatures, setShowFeatures] = useState(false);

  const radar = detail.radar;
  const ind = detail.radar_industry_avg;

  const points = [
    { axis: tGroup('fundamental'), ticker: radar.fundamental, industry: ind?.fundamental ?? 0 },
    { axis: tGroup('technical'), ticker: radar.technical, industry: ind?.technical ?? 0 },
    { axis: tGroup('macro'), ticker: radar.macro, industry: ind?.macro ?? 0 },
    { axis: tGroup('realestate'), ticker: radar.realestate, industry: ind?.realestate ?? 0 },
    { axis: tGroup('sentiment'), ticker: radar.sentiment, industry: ind?.sentiment ?? 0 },
  ];

  return (
    <section className="card p-4 flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('title')}
          </h2>
          <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('subtitle', { availability: detail.feature_availability })}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost text-2xs px-2 py-1"
          onClick={() => setShowFeatures((v) => !v)}
        >
          {showFeatures ? t('hideFeatures') : t('showFeatures')}
        </button>
      </header>

      <div style={{ width: '100%', maxWidth: 480, height: 400, alignSelf: 'center' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RRadarChart data={points} outerRadius="75%">
            <PolarGrid stroke="var(--color-theme-charcoal)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 9 }}
              stroke="var(--color-theme-charcoal)"
            />
            {ind && (
              <Radar
                name={t('legend.industry')}
                dataKey="industry"
                stroke="var(--color-theme-text-secondary)"
                fill="var(--color-theme-text-secondary)"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
            )}
            <Radar
              name={t('legend.ticker', { ticker: detail.ticker })}
              dataKey="ticker"
              stroke="var(--ssi-up)"
              fill="var(--ssi-up)"
              fillOpacity={0.45}
              isAnimationActive={false}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--color-theme-text-secondary)' }}
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
          </RRadarChart>
        </ResponsiveContainer>
      </div>

      {showFeatures && <FeatureTable detail={detail} />}
    </section>
  );
}
