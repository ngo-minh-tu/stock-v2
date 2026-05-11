'use client';

import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';

import type { Recommendation } from '@/lib/constants';

import { recommendationColor } from './ChartCard';

interface Datum {
  ticker: string;
  name: string;
  market_cap: number;
  recommendation: Recommendation;
  ai_score: number;
}

// Recharts gives custom content the leaf rect's width/height; we render label only when fits.
function CustomCell(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  ticker?: string;
  recommendation?: Recommendation;
  ai_score?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, ticker, recommendation, ai_score } = props;
  if (!recommendation) return null;
  const fontSize = Math.min(width / Math.max((ticker ?? '').length, 4) * 1.4, 14, height / 3);
  const showText = width > 28 && height > 22;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: recommendationColor(recommendation), stroke: '#00000020', strokeWidth: 1 }}
      />
      {showText && (
        <>
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight={700}
            fill={recommendation === 'GIU' ? '#1e2329' : '#ffffff'}
          >
            {ticker}
          </text>
          {height > 50 && (
            <text
              x={x + width / 2}
              y={y + height / 2 + fontSize}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={fontSize * 0.7}
              fill={recommendation === 'GIU' ? '#1e2329' : '#ffffff'}
              opacity={0.85}
            >
              {ai_score}
            </text>
          )}
        </>
      )}
    </g>
  );
}

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: Datum }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (!d) return null;
  return (
    <div
      className="text-xs rounded-md shadow-lg"
      style={{
        padding: '8px 12px',
        backgroundColor: 'var(--color-theme-tooltip-background)',
        color: recommendationColor(d.recommendation),
        border: '1px solid var(--color-theme-tooltip-border)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div className="font-bold text-sm">{d.ticker}</div>
      <div>
        {d.recommendation} · {d.ai_score}
      </div>
      <div style={{ opacity: 0.85 }}>
        Vốn hóa: {d.market_cap.toLocaleString('fr-FR')} tỷ
      </div>
    </div>
  );
}

export function TreemapChart({ data }: { data: Datum[] }) {
  // Recharts wants `size` for area weighting + `name` for label.
  const items = data.map((d) => ({
    ...d,
    size: d.market_cap,
    name: d.ticker,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={items}
        dataKey="size"
        aspectRatio={4 / 3}
        stroke="transparent"
        content={<CustomCell />}
        isAnimationActive={false}
      >
        <Tooltip content={<TooltipContent />} />
      </Treemap>
    </ResponsiveContainer>
  );
}
