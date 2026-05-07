'use client';

// Sticky header strip — ticker + name + exchange/sector on the left, price + delta in the
// middle, AI score badge + recommendation on the right. Run selector lives in the sub-row.

import { useTranslations } from 'next-intl';

import { ExchangeBadge } from '@/components/badges/ExchangeBadge';
import { RecommendationBadge } from '@/components/badges/RecommendationBadge';
import type { StockDetailResponse, TickerRunSummary } from '@/lib/types';

interface Props {
  detail: StockDetailResponse;
  runs: TickerRunSummary[];
  selectedRunId: string;
  onSelectRun: (runId: string) => void;
}

// TTCK semantic delta — ceil/up/ref/down/floor coloring, matches design.md §3.2.
function deltaColor(refPrice: number, current: number): { color: string; pct: number } {
  if (refPrice === 0 || refPrice === current) return { color: 'var(--ssi-stable)', pct: 0 };
  const pct = ((current - refPrice) / refPrice) * 100;
  if (pct >= 6.9) return { color: 'var(--ssi-ceil)', pct }; // ~ceiling
  if (pct > 0) return { color: 'var(--ssi-up)', pct };
  if (pct <= -6.9) return { color: 'var(--ssi-floor)', pct };
  return { color: 'var(--ssi-down)', pct };
}

function fmtRunOption(r: TickerRunSummary): string {
  const d = new Date(r.run_at);
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time} — score ${r.ai_score}`;
}

export function StockHeader({ detail, runs, selectedRunId, onSelectRun }: Props) {
  const t = useTranslations('stockDetail.header');
  const refPrice = detail.static.reference_price ?? detail.static.current_price;
  const { color, pct } = deltaColor(refPrice, detail.static.current_price);

  return (
    <section className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Left — ticker / name / exchange / sector */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-2xl font-bold tracking-wide"
              style={{ color: 'var(--color-theme-text-tertiary)' }}
            >
              {detail.ticker}
            </h1>
            <ExchangeBadge value={detail.static.exchange} />
            <span className="text-xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {detail.static.sector}
            </span>
          </div>
          <p
            className="text-sm truncate"
            title={detail.name}
            style={{ color: 'var(--color-theme-text-primary)', maxWidth: 360 }}
          >
            {detail.name}
          </p>
        </div>

        {/* Center — current price + delta */}
        <div className="flex flex-col items-end sm:items-center text-right sm:text-center">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color }}
          >
            {detail.static.current_price.toFixed(2)}
            <span className="text-sm font-medium ml-1">k</span>
          </span>
          <span className="text-xs tabular-nums" style={{ color }}>
            {pct > 0 ? '+' : ''}
            {pct.toFixed(2)}%
          </span>
        </div>

        {/* Right — AI score + recommendation */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span
              className="text-2xs uppercase tracking-wider"
              style={{ color: 'var(--color-theme-text-secondary)' }}
            >
              {t('aiScore')}
            </span>
            <span
              className="text-3xl font-bold tabular-nums"
              style={{ color: 'var(--color-theme-text-tertiary)' }}
            >
              {detail.scoring.ai_score}
            </span>
          </div>
          <RecommendationBadge value={detail.scoring.recommendation} size="md" />
        </div>
      </div>

      {/* Sub-row — run selector */}
      {runs.length > 0 && (
        <label className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('runSelector')}:</span>
          <select
            className="input-control"
            style={{ minWidth: 220, fontSize: 12, height: 32, padding: '0.25rem 0.5rem' }}
            value={selectedRunId}
            onChange={(e) => onSelectRun(e.target.value)}
          >
            {runs.map((r) => (
              <option key={r.run_id} value={r.run_id}>
                {fmtRunOption(r)}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
