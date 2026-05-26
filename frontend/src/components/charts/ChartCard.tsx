'use client';

import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  height?: number;
  className?: string;
  footer?: ReactNode;
  children: ReactNode;
}

// Wraps a chart in a card with standard padding + a fixed height for the chart area
// (Recharts' ResponsiveContainer needs an explicit parent height).
export function ChartCard({ title, subtitle, height = 280, className = '', footer, children }: Props) {
  return (
    <section className={`card p-4 flex flex-col gap-3 ${className}`}>
      <header>
        <h3
          className="text-sm font-medium"
          style={{ color: 'var(--color-theme-text-tertiary)' }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className="text-2xs mt-0.5"
            style={{ color: 'var(--color-theme-text-secondary)' }}
          >
            {subtitle}
          </p>
        )}
      </header>
      <div style={{ height, width: '100%' }}>{children}</div>
      {footer && (
        <div
          className="border-t pt-3 text-xs leading-relaxed"
          style={{
            borderColor: 'var(--color-theme-charcoal)',
            color: 'var(--color-theme-text-primary)',
          }}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

// Translate Recommendation enum → CSS variable matching design.md §3.2 / §7.
// Used by all charts so theme switches propagate.
export function recommendationColor(rec: 'MUA' | 'GIU' | 'BAN'): string {
  if (rec === 'MUA') return 'var(--ssi-up)';
  if (rec === 'GIU') return 'var(--ssi-ref)';
  return 'var(--ssi-down)';
}
