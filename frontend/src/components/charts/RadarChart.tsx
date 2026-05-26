'use client';

import { useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RRadarChart,
} from 'recharts';

import { ResponsiveChart } from './ResponsiveChart';
import {
  createOutwardTick,
  createRadarHoverDot,
  RadarHoverTooltip,
  type RadarHoverState,
} from './radar-tooltip';

const RADAR_TICKS = [0, 25, 50, 75, 100];

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
    values: points.map((p) => p.value),
    valueKey: 'value',
  });

  return (
    <div className="relative w-full h-full">
      <ResponsiveChart>
        <RRadarChart data={points} outerRadius="72%" cx="50%" cy="50%">
          <PolarGrid
            gridType="polygon"
            stroke="var(--color-theme-charcoal)"
          />
          <PolarAngleAxis dataKey="axis" tick={createOutwardTick(axes, 6)} />
          <PolarRadiusAxis
            type="number"
            angle={45}
            domain={[0, 100]}
            ticks={RADAR_TICKS as never}
            tickCount={RADAR_TICKS.length}
            allowDataOverflow={false}
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
      </ResponsiveChart>
      <RadarHoverTooltip state={hover} valueLabel="Score" />
    </div>
  );
}
