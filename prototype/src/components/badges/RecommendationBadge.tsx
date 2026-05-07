'use client';

import { useTranslations } from 'next-intl';

import type { Recommendation } from '@/lib/constants';

// Map enum → CSS variable. We use stock-market colors (--ssi-up/ref/down) per design.md §3.2.
const STYLE: Record<Recommendation, { bg: string; fg: string }> = {
  MUA: { bg: 'var(--ssi-up)', fg: '#000000' },
  GIU: { bg: 'var(--ssi-ref)', fg: '#1e2329' },
  BAN: { bg: 'var(--ssi-down)', fg: '#ffffff' },
};

interface Props {
  value: Recommendation;
  size?: 'sm' | 'md';
}

export function RecommendationBadge({ value, size = 'md' }: Props) {
  const t = useTranslations('recommendation');
  const style = STYLE[value];
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center justify-center rounded font-bold ${padding}`}
      style={{ backgroundColor: style.bg, color: style.fg, minWidth: size === 'sm' ? 32 : 44 }}
    >
      {t(value)}
    </span>
  );
}
