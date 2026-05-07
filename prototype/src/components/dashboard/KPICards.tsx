'use client';

import { ArrowUpRight, ArrowDownRight, Minus, ListChecks, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { DashboardResponse } from '@/lib/types';

interface Props {
  kpi: DashboardResponse['kpi'];
}

function Card({
  label,
  value,
  hint,
  color,
  Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
  Icon?: typeof ArrowUpRight;
}) {
  return (
    <div className="card p-3 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} aria-hidden="true" style={{ color }} />}
        <span
          className="text-2xs uppercase tracking-wide"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-3xl font-bold leading-none truncate"
        style={{ color: color ?? 'var(--color-theme-text-tertiary)' }}
      >
        {value}
      </div>
      {hint && (
        <span className="text-2xs truncate" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function KPICards({ kpi }: Props) {
  const t = useTranslations('dashboard.kpi');
  const alpha = kpi.alpha_vs_vnindex_pct;
  const alphaSign = alpha === null ? 0 : Math.sign(alpha);
  const alphaColor =
    alphaSign > 0 ? 'var(--ssi-up)' : alphaSign < 0 ? 'var(--ssi-down)' : 'var(--ssi-stable)';
  const AlphaIcon = alphaSign > 0 ? ArrowUpRight : alphaSign < 0 ? ArrowDownRight : Minus;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Card label={t('totalScored')} value={String(kpi.scored_count)} Icon={ListChecks} />
      <Card label={t('muaCount')} value={String(kpi.buy_count)} color="var(--ssi-up)" />
      <Card label={t('holdCount')} value={String(kpi.hold_count)} color="var(--ssi-ref)" />
      <Card label={t('sellCount')} value={String(kpi.sell_count)} color="var(--ssi-down)" />
      <Card
        label={t('alpha')}
        value={alpha === null ? '—' : `${alpha > 0 ? '+' : ''}${alpha.toFixed(1)}%`}
        hint={
          kpi.top_upside
            ? t('topUpside', { ticker: kpi.top_upside.ticker, pct: kpi.top_upside.upside_pct })
            : undefined
        }
        color={alphaColor}
        Icon={alphaSign === 0 ? TrendingUp : AlphaIcon}
      />
    </div>
  );
}
