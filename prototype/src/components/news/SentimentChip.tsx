'use client';

// Sentiment chip = colored tag with arrow icon. GUARD-08: only POSITIVE / NEUTRAL / NEGATIVE.
// Tooltip surfaces score + label so power users can see the raw number.

import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { SentimentLabelKey } from '@/lib/constants';

interface Props {
  label: SentimentLabelKey;
  score?: number;
  size?: 'sm' | 'md';
}

const TINT: Record<SentimentLabelKey, { color: string; bg: string; Icon: typeof ArrowUp }> = {
  POSITIVE: { color: 'var(--ssi-up)', bg: 'rgba(11,223,57,0.12)', Icon: ArrowUp },
  NEUTRAL:  { color: 'var(--ssi-stable)', bg: 'rgba(120,120,120,0.18)', Icon: Minus },
  NEGATIVE: { color: 'var(--ssi-down)', bg: 'rgba(255,0,23,0.14)', Icon: ArrowDown },
};

export function SentimentChip({ label, score, size = 'sm' }: Props) {
  const t = useTranslations('news.sentiment');
  const tCard = useTranslations('news.card');
  const cfg = TINT[label];
  const tooltip =
    typeof score === 'number'
      ? tCard('scoreTooltip', { score: score.toFixed(2), label: t(label) })
      : t(label);
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded ${
        size === 'sm' ? 'px-1.5 py-0.5 text-3xs' : 'px-2 py-0.5 text-2xs'
      }`}
      style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.color}` }}
    >
      <cfg.Icon size={size === 'sm' ? 10 : 12} aria-hidden="true" />
      {t(label)}
    </span>
  );
}

export const SENTIMENT_BORDER_TINT: Record<SentimentLabelKey, string> = {
  POSITIVE: 'var(--ssi-up)',
  NEUTRAL:  'var(--ssi-stable)',
  NEGATIVE: 'var(--ssi-down)',
};
