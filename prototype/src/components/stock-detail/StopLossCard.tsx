'use client';

// SRS-09 stop loss card — 10% below the buy_price (or current_price if not held yet).
// Visual: panel-frame (matches AI scoring decision panel) · centered content · chevron-down
// caption · big red price · distance pill · mini gap track.

import { useTranslations } from 'next-intl';

interface Props {
  stopLossPrice: number;
  currentPrice: number;
  hasBuyPrice: boolean;
}

export function StopLossCard({ stopLossPrice, currentPrice, hasBuyPrice }: Props) {
  const t = useTranslations('stockDetail.risk.stopLoss');
  const distancePct = ((currentPrice - stopLossPrice) / currentPrice) * 100;

  return (
    <div
      className="flex flex-col items-center gap-2.5 px-4 py-4 rounded-lg"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-theme-charcoal) 16%, transparent)',
        border: '1px solid var(--color-theme-charcoal)',
      }}
    >
      {/* Caption — chevron + label */}
      <div className="flex items-center gap-1.5">
        <ChevronDown />
        <span
          className="text-2xs uppercase tracking-[0.18em]"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          {t('title')}
        </span>
      </div>

      {/* Big price */}
      <div className="flex items-baseline gap-1.5 leading-none">
        <span
          className="text-3xl font-bold tabular-nums"
          style={{ color: 'var(--ssi-down)' }}
        >
          {stopLossPrice.toFixed(2)}
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          k
        </span>
      </div>

      {/* Distance pill */}
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold tabular-nums tracking-wider"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--ssi-down) 14%, transparent)',
          color: 'var(--ssi-down)',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'color-mix(in srgb, var(--ssi-down) 55%, transparent)',
        }}
        title={t('distance', { pct: distancePct.toFixed(1) })}
      >
        <span
          aria-hidden
          className="inline-block rounded-full"
          style={{
            width: 6,
            height: 6,
            backgroundColor: 'var(--ssi-down)',
            boxShadow: '0 0 6px var(--ssi-down)',
          }}
        />
        −{distancePct.toFixed(1)}%
      </span>

      {/* Calc note */}
      <span
        className="text-2xs text-center"
        style={{ color: 'var(--color-theme-text-secondary)' }}
      >
        {hasBuyPrice ? t('calc.buyPrice') : t('calc.currentPrice')}
      </span>

      {/* Mini gap track */}
      <GapTrack stopLossPrice={stopLossPrice} currentPrice={currentPrice} />
    </div>
  );
}

function ChevronDown() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ssi-down)"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function GapTrack({
  stopLossPrice,
  currentPrice,
}: {
  stopLossPrice: number;
  currentPrice: number;
}) {
  return (
    <div className="flex flex-col gap-1 mt-1 w-full">
      <div
        className="relative h-1.5 rounded-full"
        style={{
          background:
            'linear-gradient(to right, color-mix(in srgb, var(--ssi-down) 80%, transparent) 0%, color-mix(in srgb, var(--ssi-down) 12%, transparent) 100%)',
        }}
      >
        <span
          className="absolute -top-1 left-0 block rounded-full"
          style={{
            width: 10,
            height: 10,
            backgroundColor: 'var(--ssi-down)',
            boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-theme-charcoal) 60%, var(--color-theme-card-bg))',
          }}
          aria-label="stop loss"
        />
        <span
          className="absolute -top-1 right-0 block rounded-full"
          style={{
            width: 10,
            height: 10,
            backgroundColor: 'var(--color-theme-text-tertiary)',
            boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-theme-charcoal) 60%, var(--color-theme-card-bg))',
          }}
          aria-label="current price"
        />
      </div>
      <div
        className="flex justify-between text-2xs tabular-nums"
        style={{ color: 'var(--color-theme-text-secondary)' }}
      >
        <span>{stopLossPrice.toFixed(2)}k</span>
        <span>{currentPrice.toFixed(2)}k</span>
      </div>
    </div>
  );
}
