'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RRadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface Datum {
  fundamental: number;
  technical: number;
  macro: number;
  realestate: number;
  sentiment: number;
}

export function RadarChart({ data }: { data: Datum }) {
  const points = [
    { axis: 'Fundamental', value: data.fundamental },
    { axis: 'Technical', value: data.technical },
    { axis: 'Macro', value: data.macro },
    { axis: 'Real Estate', value: data.realestate },
    { axis: 'Sentiment', value: data.sentiment },
  ];

  return (
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
        <Radar
          dataKey="value"
          stroke="var(--ssi-up)"
          fill="var(--ssi-up)"
          fillOpacity={0.35}
          isAnimationActive={false}
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
  );
}
