'use client';

// Shared hover-dot + inward-positioned tooltip for RadarCharts.
// Replaces recharts' default <Tooltip> which follows the cursor and "jumps".
// Position is computed once from the dot's polar coordinates and pinned
// INSIDE the polygon (toward center) so it never overlaps the
// PolarAngleAxis labels that sit just outside the polygon edge.

const RADIAN = Math.PI / 180;

// Recharts RadarChart places axis 0 at angle 90° (top) and walks clockwise.
// Returns a unit vector pointing from chart center outward to the i-th axis.
export function radarOutwardVector(index: number, total: number) {
  const angleDeg = 90 - (index * 360) / total;
  const a = angleDeg * RADIAN;
  return { dx: Math.cos(a), dy: -Math.sin(a) };
}

export interface RadarHoverState {
  x: number;
  y: number;
  dx: number;
  dy: number;
  axis: string;
  value: number;
  color: string;
  seriesName?: string;
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  value?: number;
  payload?: Record<string, unknown>;
}

export function createRadarHoverDot({
  axes,
  color,
  onHover,
  seriesName,
  values,
  valueKey,
}: {
  axes: string[];
  color: string;
  onHover: (state: RadarHoverState | null) => void;
  seriesName?: string;
  values?: number[];
  valueKey: string;
}) {
  const total = axes.length;
  return function RadarHoverDot(props: DotProps) {
    const { cx, cy, index, value, payload } = props;
    if (typeof cx !== 'number' || typeof cy !== 'number' || typeof index !== 'number') {
      return <g key={`radar-dot-empty-${index ?? 'unknown'}`} />;
    }
    const rawPayloadValue = payload?.[valueKey];
    const resolvedValue =
      typeof values?.[index] === 'number'
        ? values[index]
        : typeof rawPayloadValue === 'number'
        ? rawPayloadValue
        : typeof value === 'number'
        ? value
        : 0;
    const { dx, dy } = radarOutwardVector(index, total);
    const enter = () =>
      onHover({
        x: cx,
        y: cy,
        dx,
        dy,
        // axes lookup is more reliable than payload.axis (recharts dot props
        // can vary by version / lose original data fields after transform).
        axis: axes[index] ?? '',
        value: resolvedValue,
        color,
        seriesName,
      });
    const leave = () => onHover(null);
    return (
      <g key={`radar-dot-${seriesName ?? 'series'}-${index}`}>
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill={color}
          stroke="var(--color-theme-card-bg)"
          strokeWidth={1.5}
        />
        {/* invisible larger hitbox for easier hover targeting */}
        <circle
          cx={cx}
          cy={cy}
          r={14}
          fill="transparent"
          pointerEvents="all"
          style={{ cursor: 'pointer' }}
          onMouseEnter={enter}
          onMouseLeave={leave}
        />
      </g>
    );
  };
}

interface TickProps {
  x?: number;
  y?: number;
  payload?: { value?: string };
  textAnchor?: 'start' | 'middle' | 'end';
  verticalAnchor?: 'start' | 'middle' | 'end';
}

// Custom PolarAngleAxis tick that pushes labels further outward from the
// polygon edge — gives breathing room between e.g. "Fundamental" (axis label)
// and "100" (PolarRadiusAxis label). Recharts default offset is ~5px, often
// too tight on dense radars.
export function createOutwardTick(axes: string[], push = 5) {
  const total = axes.length;
  return function OutwardTick(props: TickProps) {
    const { x = 0, y = 0, payload, textAnchor, verticalAnchor } = props;
    const value = payload?.value ?? '';
    const idx = axes.indexOf(value);
    if (idx < 0) return <g />;
    const a = ((90 - (idx * 360) / total) * RADIAN);
    const dx = Math.cos(a) * push;
    const dy = -Math.sin(a) * push;
    const dominantBaseline =
      verticalAnchor === 'start' ? 'hanging'
      : verticalAnchor === 'middle' ? 'central'
      : 'auto';
    return (
      <text
        x={x + dx}
        y={y + dy}
        textAnchor={textAnchor}
        dominantBaseline={dominantBaseline}
        fill="var(--color-theme-text-secondary)"
        fontSize={11}
      >
        {value}
      </text>
    );
  };
}

export function RadarHoverTooltip({
  state,
  offset = 24,
  valueLabel = 'Score',
}: {
  state: RadarHoverState | null;
  offset?: number;
  valueLabel?: string;
}) {
  if (!state) return null;
  // Position INWARD (toward chart center) so the tooltip never lands on top
  // of PolarAngleAxis labels (Fundamental / Technical / Sentiment / …) that
  // sit just outside the polygon. Polygon interior is dense visually but the
  // tooltip's solid background covers grid lines cleanly.
  const tx = state.x - state.dx * offset;
  const ty = state.y - state.dy * offset;
  // The tooltip edge facing the dot should anchor at (tx, ty). With INWARD
  // placement, that means the side facing OUTWARD direction.
  // dx > 0 (dot on right) → tooltip on left of dot → its right edge anchors → -100%.
  // dx < 0 (dot on left)  → tooltip on right of dot → its left edge anchors → 0%.
  // Threshold 0.3 keeps near-axis points centered for a balanced look.
  const translateX = state.dx > 0.3 ? '-100%' : state.dx < -0.3 ? '0%' : '-50%';
  const translateY = state.dy > 0.3 ? '-100%' : state.dy < -0.3 ? '0%' : '-50%';
  return (
    <div
      className="absolute pointer-events-none text-xs rounded-md shadow-lg"
      style={{
        left: tx,
        top: ty,
        transform: `translate(${translateX}, ${translateY})`,
        padding: '8px 12px',
        backgroundColor: 'var(--color-theme-tooltip-background)',
        border: '1px solid var(--color-theme-tooltip-border)',
        color: 'var(--color-theme-text-tertiary)',
        backdropFilter: 'blur(2px)',
        whiteSpace: 'nowrap',
        zIndex: 5,
      }}
    >
      {state.axis && (
        <div className="font-bold text-sm mb-1" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {state.axis}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block rounded-full"
          style={{ width: 7, height: 7, backgroundColor: state.color }}
        />
        {state.seriesName && (
          <span style={{ color: 'var(--color-theme-text-secondary)' }}>{state.seriesName}</span>
        )}
        <span style={{ color: 'var(--color-theme-text-secondary)' }}>{valueLabel}:</span>
        <span className="font-semibold tabular-nums" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {Number(state.value).toFixed(2)}/100
        </span>
      </div>
    </div>
  );
}
