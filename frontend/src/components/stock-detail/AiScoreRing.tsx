'use client';

// AI score donut — SVG ring with the score in the center. Color is tier-based:
// ≥70 buy/green, 40-69 hold/amber, <40 sell/red. Theme-aware via CSS vars.

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

function tierColor(score: number): string {
  if (score >= 70) return 'var(--ssi-up)';
  if (score >= 40) return '#f49f3b';
  return 'var(--ssi-down)';
}

export function AiScoreRing({ score, size = 84, strokeWidth = 8, label }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const color = tierColor(clamped);
  const scoreText = String(clamped);
  const scoreFontSize = Math.round(
    size * (scoreText.length >= 5 ? 0.25 : scoreText.length >= 4 ? 0.28 : 0.32),
  );

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={label ?? `AI score ${clamped}/100`}
      role="img"
    >
      <svg width={size} height={size} className="block -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-theme-charcoal)"
          strokeWidth={strokeWidth}
          opacity={0.4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          style={{ transition: 'stroke-dasharray 240ms ease, stroke 240ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span
          className="font-bold tabular-nums"
          style={{
            color: 'var(--color-theme-text-tertiary)',
            fontSize: scoreFontSize,
          }}
        >
          {scoreText}
        </span>
        <span
          className="tabular-nums"
          style={{
            color: 'var(--color-theme-text-secondary)',
            fontSize: Math.round(size * 0.13),
            marginTop: 2,
          }}
        >
          /100
        </span>
      </div>
    </div>
  );
}
