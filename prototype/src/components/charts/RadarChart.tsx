'use client';

import { useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RRadarChart,
  ResponsiveContainer,
} from 'recharts';

import {
  createOutwardTick,
  createRadarHoverDot,
  RadarHoverTooltip,
  type RadarHoverState,
} from './radar-tooltip';

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

  const [hover, setHover] = useState<RadarHoverState | null>(null);

  const axes = points.map((p) => p.axis);
  const renderDot = createRadarHoverDot({
    axes,
    color: 'var(--ssi-up)',
    onHover: setHover,
  });

  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RRadarChart data={points} outerRadius="72%">
          <PolarGrid stroke="var(--color-theme-charcoal)" />
          <PolarAngleAxis dataKey="axis" tick={createOutwardTick(axes, 6)} />
          <PolarRadiusAxis
            angle={45}
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
            dot={renderDot}
            activeDot={false}
          />
        </RRadarChart>
      </ResponsiveContainer>
      <RadarHoverTooltip state={hover} />
    </div>
  );
}
