'use client';

// Confidence breakdown — visualizes raw → penalty → final per PRD §7.7.
// Each warning badge has a tooltip explaining its trigger condition.

import { useLocale, useTranslations } from 'next-intl';

import type { WarningBadge } from '@/lib/constants';
import { WARNING_BADGE_META } from '@/mocks/data/warning-badges';

interface Props {
  confidenceRaw: number;
  confidencePenalty: number;
  confidenceFinal: number;
  badges: WarningBadge[];
}

export function ConfidenceCard({
  confidenceRaw,
  confidencePenalty,
  confidenceFinal,
  badges,
}: Props) {
  const t = useTranslations('stockDetail.risk.confidence');
  const tWarn = useTranslations('warning');
  const locale = useLocale() as 'vi' | 'en';

  // Visual bar — raw fills the whole; the penalty band overlays the right portion.
  const rawPct = Math.max(0, Math.min(100, confidenceRaw));
  const penaltyPct = Math.max(0, Math.min(rawPct, confidencePenalty));
  const finalPct = Math.max(0, rawPct - penaltyPct);

  return (
    <div className="card p-4 flex flex-col gap-3">
      <h3 className="text-2xs uppercase tracking-wider" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {t('title')}
      </h3>

      {/* Bar */}
      <div className="flex flex-col gap-1.5">
        <div
          className="relative h-5 rounded overflow-hidden"
          style={{ backgroundColor: 'var(--color-theme-tertiary)' }}
        >
          <span
            className="absolute top-0 bottom-0 left-0"
            style={{ width: `${finalPct}%`, backgroundColor: 'var(--ssi-up)' }}
          />
          {penaltyPct > 0 && (
            <span
              className="absolute top-0 bottom-0"
              style={{
                left: `${finalPct}%`,
                width: `${penaltyPct}%`,
                backgroundColor: '#f49f3b',
              }}
              title={t('penaltyTooltip', { points: confidencePenalty })}
            />
          )}
        </div>
        <div
          className="flex justify-between text-2xs tabular-nums"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          <span>
            {t('raw')}: <span style={{ color: 'var(--color-theme-text-primary)' }}>{confidenceRaw}%</span>
          </span>
          <span>
            {t('penalty')}: <span style={{ color: '#f49f3b' }}>−{confidencePenalty}pp</span>
          </span>
          <span>
            {t('final')}:{' '}
            <span style={{ color: 'var(--color-theme-text-tertiary)', fontWeight: 600 }}>
              {confidenceFinal}%
            </span>
          </span>
        </div>
      </div>

      {/* Warning badges with tooltips */}
      {badges.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span
            className="text-2xs uppercase tracking-wider"
            style={{ color: 'var(--color-theme-text-secondary)' }}
          >
            {t('warningsLabel')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {badges.map((b) => {
              const meta = WARNING_BADGE_META[b];
              return (
                <span
                  key={b}
                  className="inline-flex items-center px-2 py-0.5 rounded text-2xs border"
                  style={{
                    backgroundColor: 'rgba(244, 159, 59, 0.15)',
                    color: '#f49f3b',
                    borderColor: '#f49f3b',
                  }}
                  title={locale === 'vi' ? meta.trigger_vi : meta.trigger_en}
                >
                  {tWarn(b)}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <span className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('noWarnings')}
        </span>
      )}
    </div>
  );
}
