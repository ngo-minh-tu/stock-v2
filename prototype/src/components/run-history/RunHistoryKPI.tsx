'use client';

import { History, Clock, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  totalRuns: number;
  lastRunAt: string | null;
  lastAccuracyPct: number | null; // null when no backtest has run
}

function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'vừa xong';
  if (diffMin < 60) return `${diffMin}p trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h trước`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} ngày trước`;
}

function Card({
  label,
  value,
  hint,
  Icon,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof History;
  color?: string;
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
      <span
        className="text-xl font-bold leading-tight tabular-nums truncate"
        style={{ color: color ?? 'var(--color-theme-text-tertiary)' }}
      >
        {value}
      </span>
      {hint && (
        <span className="text-2xs truncate" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {hint}
        </span>
      )}
    </div>
  );
}

export function RunHistoryKPI({ totalRuns, lastRunAt, lastAccuracyPct }: Props) {
  const t = useTranslations('runHistory.kpi');
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <Card label={t('totalRuns')} value={String(totalRuns)} Icon={History} />
      <Card
        label={t('lastRun')}
        value={lastRunAt ? relativeTime(lastRunAt) : '—'}
        hint={lastRunAt ? new Date(lastRunAt).toLocaleString('fr-FR') : undefined}
        Icon={Clock}
      />
      <Card
        label={t('avgAccuracy')}
        value={lastAccuracyPct !== null ? `${lastAccuracyPct.toFixed(1)}%` : '—'}
        hint={lastAccuracyPct === null ? t('avgAccuracyHint') : undefined}
        Icon={Target}
        color={lastAccuracyPct !== null && lastAccuracyPct >= 60 ? 'var(--ssi-up)' : undefined}
      />
    </div>
  );
}
