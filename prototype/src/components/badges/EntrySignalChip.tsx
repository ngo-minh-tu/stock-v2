'use client';

import { useTranslations } from 'next-intl';

import type { EntrySignal } from '@/lib/constants';

// Match the 7 signals to a tone — three buckets: aggressive buy, wait, no-go.
const TONE: Record<EntrySignal, 'buy' | 'wait' | 'none'> = {
  BUY_STRONG: 'buy',
  BUY_NOW: 'buy',
  WAIT_FOR_BREAKOUT: 'wait',
  WAIT_FOR_PULLBACK: 'wait',
  WAIT_FOR_CONFIRMATION: 'wait',
  NO_ENTRY: 'none',
  INSUFFICIENT_DATA: 'none',
};

const TONE_STYLE: Record<'buy' | 'wait' | 'none', { bg: string; fg: string; border: string }> = {
  buy: { bg: 'rgba(11, 223, 57, 0.12)', fg: 'var(--ssi-up)', border: 'var(--ssi-up)' },
  wait: { bg: 'rgba(253, 255, 18, 0.12)', fg: 'var(--ssi-ref)', border: 'var(--ssi-ref)' },
  none: { bg: 'rgba(255, 0, 23, 0.10)', fg: 'var(--ssi-down)', border: 'var(--ssi-down)' },
};

export function EntrySignalChip({ value }: { value: EntrySignal }) {
  const t = useTranslations('entry.signal');
  const tone = TONE[value];
  const style = TONE_STYLE[tone];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium border"
      style={{
        backgroundColor: style.bg,
        color: style.fg,
        borderColor: style.border,
      }}
    >
      {t(value)}
    </span>
  );
}
