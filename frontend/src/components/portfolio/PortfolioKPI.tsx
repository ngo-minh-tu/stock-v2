'use client';

import { Briefcase, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  totalCost: number;        // VND
  currentValue: number;     // VND
  totalPnl: number;         // VND
  totalPnlPct: number;      // %
  holdingCount: number;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' VND';
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
  Icon: typeof Briefcase;
}) {
  return (
    <div className="card p-3 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        <Icon size={12} aria-hidden="true" style={{ color }} />
        <span
          className="text-2xs uppercase tracking-wide"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-xl font-bold leading-tight truncate"
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

export function PortfolioKPI({
  totalCost,
  currentValue,
  totalPnl,
  totalPnlPct,
  holdingCount,
}: Props) {
  const t = useTranslations('portfolio.kpi');
  const pnlSign = Math.sign(totalPnl);
  const pnlColor =
    pnlSign > 0 ? 'var(--ssi-up)' : pnlSign < 0 ? 'var(--ssi-down)' : 'var(--ssi-stable)';
  const PnlIcon = pnlSign > 0 ? ArrowUpRight : pnlSign < 0 ? ArrowDownRight : Minus;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card label={t('totalCost')} value={formatVnd(totalCost)} Icon={Wallet} />
      <Card
        label={t('currentValue')}
        value={formatVnd(currentValue)}
        Icon={TrendingUp}
        color="var(--color-theme-text-tertiary)"
      />
      <Card
        label={t('totalPnl')}
        value={`${totalPnl > 0 ? '+' : ''}${formatVnd(totalPnl)}`}
        hint={`${totalPnlPct > 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`}
        color={pnlColor}
        Icon={PnlIcon}
      />
      <Card label={t('holdingCount')} value={String(holdingCount)} Icon={Briefcase} />
    </div>
  );
}
