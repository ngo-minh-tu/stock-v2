'use client';

// Big bordered card showing the entry signal as a hero chip + a parsed reason list,
// the raw indicators consulted, and a mini bar visualizing where current price sits
// between support and resistance.

import { useLocale, useTranslations } from 'next-intl';

import { ENTRY_SIGNAL_META, type EntrySignal } from '@/lib/constants';
import type { StockDetailResponse } from '@/lib/types';
import { parseReasonCode, reasonLabel } from '@/mocks/data/reason-codes';

interface Props {
  detail: StockDetailResponse;
}

const TONE_STYLE: Record<
  EntrySignal,
  { bg: string; fg: string; border: string; icon: string }
> = {
  BUY_STRONG: {
    bg: 'rgba(11, 223, 57, 0.18)',
    fg: 'var(--ssi-up)',
    border: 'var(--ssi-up)',
    icon: '🟢',
  },
  BUY_NOW: {
    bg: 'rgba(11, 223, 57, 0.10)',
    fg: 'var(--ssi-up)',
    border: 'var(--ssi-up)',
    icon: '🟢',
  },
  WAIT_FOR_BREAKOUT: {
    bg: 'rgba(253, 255, 18, 0.10)',
    fg: 'var(--ssi-ref)',
    border: 'var(--ssi-ref)',
    icon: '🟡',
  },
  WAIT_FOR_PULLBACK: {
    bg: 'rgba(253, 255, 18, 0.10)',
    fg: 'var(--ssi-ref)',
    border: 'var(--ssi-ref)',
    icon: '🟡',
  },
  WAIT_FOR_CONFIRMATION: {
    bg: 'rgba(253, 255, 18, 0.10)',
    fg: 'var(--ssi-ref)',
    border: 'var(--ssi-ref)',
    icon: '🟡',
  },
  NO_ENTRY: {
    bg: 'rgba(120, 120, 120, 0.12)',
    fg: 'var(--color-theme-text-secondary)',
    border: 'var(--color-theme-charcoal)',
    icon: '⚫',
  },
  INSUFFICIENT_DATA: {
    bg: 'rgba(180, 180, 180, 0.12)',
    fg: 'var(--color-theme-text-secondary)',
    border: 'var(--color-theme-charcoal)',
    icon: '⚠️',
  },
};

// Mini horizontal bar — shows where current price sits between support and resistance.
function SRBar({
  current,
  support,
  resistance,
}: {
  current: number;
  support: number;
  resistance: number;
}) {
  const lo = Math.min(support, current * 0.95);
  const hi = Math.max(resistance, current * 1.05);
  const span = Math.max(hi - lo, 0.01);
  const pos = ((current - lo) / span) * 100;
  const supX = ((support - lo) / span) * 100;
  const resX = ((resistance - lo) / span) * 100;
  return (
    <div className="relative h-8 rounded" style={{ backgroundColor: 'var(--color-theme-tertiary)' }}>
      {/* Support marker */}
      <span
        className="absolute top-0 bottom-0 w-px"
        style={{ left: `${supX}%`, backgroundColor: 'var(--ssi-up)' }}
      />
      {/* Resistance marker */}
      <span
        className="absolute top-0 bottom-0 w-px"
        style={{ left: `${resX}%`, backgroundColor: 'var(--ssi-down)' }}
      />
      {/* Current price marker */}
      <span
        className="absolute top-0 bottom-0 w-1 rounded"
        style={{ left: `calc(${pos}% - 2px)`, backgroundColor: 'var(--color-theme-text-tertiary)' }}
      />
      <span
        className="absolute -top-3.5 text-2xs tabular-nums"
        style={{ left: `${supX}%`, transform: 'translateX(-50%)', color: 'var(--ssi-up)' }}
      >
        S {support.toFixed(2)}
      </span>
      <span
        className="absolute -bottom-4 text-2xs tabular-nums"
        style={{
          left: `calc(${pos}% - 2px)`,
          transform: 'translateX(-50%)',
          color: 'var(--color-theme-text-tertiary)',
        }}
      >
        ▲ {current.toFixed(2)}
      </span>
      <span
        className="absolute -top-3.5 text-2xs tabular-nums"
        style={{ left: `${resX}%`, transform: 'translateX(-50%)', color: 'var(--ssi-down)' }}
      >
        R {resistance.toFixed(2)}
      </span>
    </div>
  );
}

export function EntrySignalPanel({ detail }: Props) {
  const t = useTranslations('stockDetail.entry');
  const tSig = useTranslations('entry.signal');
  const locale = useLocale() as 'vi' | 'en';
  const signal = detail.entry.signal;
  const style = TONE_STYLE[signal];
  const meta = ENTRY_SIGNAL_META[signal];

  const reasonCodes = parseReasonCode(detail.entry.reason_code);

  const isInsufficient = signal === 'INSUFFICIENT_DATA';

  return (
    <section
      className="card p-4 flex flex-col gap-4"
      style={{ borderColor: 'var(--color-theme-crimson)', borderWidth: 1 }}
    >
      <header>
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('title')}
        </h2>
        <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('subtitle', { priority: meta.priority })}
        </p>
      </header>

      {/* Hero signal chip */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="inline-flex items-center gap-2 px-4 py-2 rounded text-base font-bold border"
          style={{
            backgroundColor: style.bg,
            color: style.fg,
            borderColor: style.border,
          }}
        >
          <span aria-hidden="true">{style.icon}</span>
          {tSig(signal)}
        </span>
        {!isInsufficient && (
          <span
            className="text-2xs uppercase tracking-wider"
            style={{ color: 'var(--color-theme-text-secondary)' }}
          >
            {t('reasonCodeLabel')}: <span style={{ fontFamily: 'monospace' }}>{detail.entry.reason_code}</span>
          </span>
        )}
      </div>

      {/* Parsed reasons */}
      <div className="flex flex-wrap gap-1.5">
        {reasonCodes.map((c) => (
          <span
            key={c}
            className="inline-flex items-center px-2 py-0.5 rounded text-2xs border"
            style={{
              borderColor: 'var(--color-theme-charcoal)',
              color: 'var(--color-theme-text-primary)',
              backgroundColor: 'var(--color-theme-tertiary)',
            }}
          >
            {reasonLabel(c, locale)}
          </span>
        ))}
      </div>

      {/* S/R visualization (skip for INSUFFICIENT_DATA) */}
      {!isInsufficient && (
        <div className="flex flex-col gap-2 pt-2">
          <span
            className="text-2xs uppercase tracking-wider"
            style={{ color: 'var(--color-theme-text-secondary)' }}
          >
            {t('srBar.title')}
          </span>
          <div className="px-2 pt-5 pb-6">
            <SRBar
              current={detail.static.current_price}
              support={detail.entry.support_zone}
              resistance={detail.entry.resistance_zone}
            />
          </div>
        </div>
      )}

      {/* Raw indicators consulted */}
      {detail.entry.raw_indicators_used.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span
            className="text-2xs uppercase tracking-wider"
            style={{ color: 'var(--color-theme-text-secondary)' }}
          >
            {t('indicators')}
          </span>
          <div className="flex flex-wrap gap-1">
            {detail.entry.raw_indicators_used.map((ind) => (
              <span
                key={ind}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono"
                style={{
                  backgroundColor: 'var(--color-theme-tertiary)',
                  color: 'var(--color-theme-text-secondary)',
                }}
              >
                {ind}
              </span>
            ))}
          </div>
        </div>
      )}

      {isInsufficient && (
        <p className="text-xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('insufficientNote')}
        </p>
      )}
    </section>
  );
}
