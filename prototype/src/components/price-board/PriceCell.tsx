'use client';

// Single-purpose price cell that applies the TTCK color rule (cluster 4 prompt §3.3).
// `mode` lets the same component handle the static columns (always one color) and the
// dynamic columns (close/change/changePct, color depends on close vs ref/ceiling/floor).

import { priceColor, type TtckColor } from '@/lib/constants';

type Mode = 'static' | 'dynamic';

interface BaseProps {
  /** What number to display. */
  value: number | null | undefined;
  /** "—" when value is null/undefined. */
  placeholder?: string;
  /** Number formatter, default 2 decimals. */
  format?: (n: number) => string;
  className?: string;
  /** Tabular alignment makes per-column digits line up nicely. */
  align?: 'right' | 'center' | 'left';
}

interface StaticProps extends BaseProps {
  mode: 'static';
  /** Force a fixed token color (used for ref/ceiling/floor columns). */
  fixedColor: TtckColor | 'primary';
}

interface DynamicProps extends BaseProps {
  mode: 'dynamic';
  /** Anchor the TTCK rule against this ticker's snapshot. */
  ceiling: number;
  floor: number;
  reference: number;
  /** When provided, the rule colors against this number instead of `value` (e.g. change uses close). */
  anchor?: number;
}

export type PriceCellProps = (StaticProps | DynamicProps) & { mode: Mode };

const TOKEN: Record<TtckColor | 'primary', string> = {
  ceil: 'var(--ssi-ceil)',
  up: 'var(--ssi-up)',
  ref: 'var(--ssi-ref)',
  down: 'var(--ssi-down)',
  floor: 'var(--ssi-floor)',
  primary: 'var(--color-theme-text-primary)',
};

function formatDefault(n: number): string {
  return n.toFixed(2);
}

export function PriceCell(props: PriceCellProps) {
  const { value, placeholder = '—', format = formatDefault, className = '', align = 'right' } = props;
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className={`tabular-nums ${className}`} style={{ textAlign: align as never }}>
        {placeholder}
      </span>
    );
  }

  let color: string;
  if (props.mode === 'static') {
    color = TOKEN[props.fixedColor];
  } else {
    const anchor = props.anchor ?? value;
    color = TOKEN[priceColor(anchor, props.ceiling, props.floor, props.reference)];
  }

  return (
    <span
      className={`tabular-nums ${className}`}
      style={{ color, textAlign: align as never, display: 'inline-block', minWidth: '100%' }}
    >
      {format(value)}
    </span>
  );
}
