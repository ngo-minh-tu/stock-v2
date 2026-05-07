'use client';

// Text-only source "logo" — initials in a colored box. Cluster prompt §10 says don't
// download real logos; the prototype just needs visual differentiation per source.

import type { NewsSourceKey } from '@/lib/constants';

const SOURCE_TINT: Record<NewsSourceKey, { fg: string; bg: string; initial: string }> = {
  CAFEF:      { fg: '#fff', bg: '#d32f2f', initial: 'C' },
  VNEXPRESS:  { fg: '#fff', bg: '#1769aa', initial: 'V' },
  VIETSTOCK:  { fg: '#fff', bg: '#2e7d32', initial: 'S' },
  BATDONGSAN: { fg: '#fff', bg: '#e64a19', initial: 'B' },
  THANHNIEN:  { fg: '#fff', bg: '#5d4037', initial: 'T' },
};

interface Props {
  source: NewsSourceKey;
  size?: 'sm' | 'md';
}

export function SourceLogo({ source, size = 'md' }: Props) {
  const cfg = SOURCE_TINT[source];
  const dim = size === 'sm' ? 18 : 24;
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded font-bold"
      style={{
        width: dim,
        height: dim,
        backgroundColor: cfg.bg,
        color: cfg.fg,
        fontSize: size === 'sm' ? 10 : 12,
        flexShrink: 0,
      }}
    >
      {cfg.initial}
    </span>
  );
}

export const SOURCE_BORDER_TINT: Record<NewsSourceKey, string> = {
  CAFEF: '#d32f2f',
  VNEXPRESS: '#1769aa',
  VIETSTOCK: '#2e7d32',
  BATDONGSAN: '#e64a19',
  THANHNIEN: '#5d4037',
};
