'use client';

// SRS-09 stop loss card — 10% below the buy_price (or current_price if not held yet).

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
    <div className="card p-4 flex flex-col gap-2">
      <h3 className="text-2xs uppercase tracking-wider" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {t('title')}
      </h3>
      <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--ssi-down)' }}>
        {stopLossPrice.toFixed(2)}
        <span className="text-sm font-medium ml-1">k</span>
      </span>
      <span className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {hasBuyPrice ? t('calc.buyPrice') : t('calc.currentPrice')}
      </span>
      <span className="text-xs" style={{ color: 'var(--color-theme-text-primary)' }}>
        {t('distance', { pct: distancePct.toFixed(1) })}
      </span>
    </div>
  );
}
