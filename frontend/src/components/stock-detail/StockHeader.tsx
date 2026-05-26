'use client';

// Sticky header strip — ticker + name + exchange/sector on the left, price and AI score
// decision cards on the right. Run selector lives in the sub-row.

import { useTranslations } from 'next-intl';

import { ExchangeBadge } from '@/components/badges/ExchangeBadge';
import type { Recommendation } from '@/lib/constants';
import type { StockDetailResponse, TickerRunSummary } from '@/lib/types';

import { AiScoreRing } from './AiScoreRing';

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

// Recommendation pill — soft tinted bg + 1px border in the same hue + leading status dot.
// Replaces the loud full-fill rectangle of RecommendationBadge for the header context.
const RECO_HUE: Record<Recommendation, string> = {
  MUA: 'var(--ssi-up)',
  GIU: '#f49f3b',
  BAN: 'var(--ssi-down)',
};

function RecommendationPill({ value }: { value: Recommendation }) {
  const t = useTranslations('recommendation');
  const hue = RECO_HUE[value];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold tracking-wider uppercase"
      style={{
        backgroundColor: 'color-mix(in srgb, ' + hue + ' 14%, transparent)',
        borderColor: 'color-mix(in srgb, ' + hue + ' 55%, transparent)',
        borderWidth: 1,
        borderStyle: 'solid',
        color: hue,
      }}
    >
      <span
        aria-hidden
        className="inline-block rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: hue,
          boxShadow: '0 0 6px ' + hue,
        }}
      />
      {t(value)}
    </span>
  );
}

function DeltaArrow({ up }: { up: boolean }) {
  return (
    <svg
      width={10}
      height={10}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      style={{ transform: up ? 'rotate(0deg)' : 'rotate(180deg)' }}
    >
      <polygon points="12,4 20,18 4,18" />
    </svg>
  );
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
        <div className="flex flex-col gap-1 min-w-[220px] flex-1">
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

        <div className="flex flex-wrap items-stretch justify-end gap-3">
          <div
            className="flex min-w-[160px] flex-col items-center justify-center gap-2 px-4 py-3 rounded-lg"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-theme-charcoal) 16%, transparent)',
              border: '1px solid var(--color-theme-charcoal)',
            }}
          >
            <span
              className="text-2xs uppercase tracking-[0.18em]"
              style={{ color: 'var(--color-theme-text-secondary)' }}
            >
              {t('currentPrice')}
            </span>
            <span className="text-3xl font-bold tabular-nums leading-none" style={{ color }}>
              {detail.static.current_price.toFixed(2)}
              <span
                className="text-sm font-medium ml-1"
                style={{ color: 'var(--color-theme-text-secondary)' }}
              >
                k
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs tabular-nums" style={{ color }}>
              {pct !== 0 && <DeltaArrow up={pct > 0} />}
              {pct > 0 ? '+' : ''}
              {pct.toFixed(2)}%
            </span>
          </div>

          <div
            className="flex flex-col items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-theme-charcoal) 16%, transparent)',
              border: '1px solid var(--color-theme-charcoal)',
            }}
          >
            <span
              className="text-2xs uppercase tracking-[0.18em]"
              style={{ color: 'var(--color-theme-text-secondary)' }}
            >
              {t('aiScore')}
            </span>
            <AiScoreRing score={detail.scoring.ai_score} size={84} strokeWidth={8} label={t('aiScore')} />
            <RecommendationPill value={detail.scoring.recommendation} />
          </div>
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
