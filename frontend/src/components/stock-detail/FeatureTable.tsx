'use client';

// 38-feature breakdown grouped into the 5 buckets, with each group collapsible.
// Coloring per AC-08-05 — green for "good direction", red for "bad", neutral otherwise.

import { ChevronDown, ChevronRight, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  FEATURE_DICT,
  FEATURE_GROUPS,
  type FeatureGroup,
  type FeatureMeta,
  featureDirectionTone,
  formatFeatureValue,
} from '@/mocks/data/feature-dict';
import type { StockDetailResponse } from '@/lib/types';

interface Props {
  detail: StockDetailResponse;
}

const TONE_COLOR: Record<'good' | 'bad' | 'neutral', { fg: string; bg: string }> = {
  good: { fg: 'var(--ssi-up)', bg: 'rgba(11,223,57,0.08)' },
  bad: { fg: 'var(--ssi-down)', bg: 'rgba(255,0,23,0.08)' },
  neutral: { fg: 'var(--color-theme-text-primary)', bg: 'transparent' },
};

function DirectionIcon({ meta }: { meta: FeatureMeta }) {
  if (meta.direction === 'high') return <ArrowUp size={11} aria-hidden="true" />;
  if (meta.direction === 'low') return <ArrowDown size={11} aria-hidden="true" />;
  return <Minus size={11} aria-hidden="true" />;
}

export function FeatureTable({ detail }: Props) {
  const t = useTranslations('stockDetail.feature');
  const tGroup = useTranslations('stockDetail.feature.group');
  const locale = useLocale() as 'vi' | 'en';
  const [openGroups, setOpenGroups] = useState<Record<FeatureGroup, boolean>>({
    fundamental: true,
    technical: true,
    macro: false,
    realestate: false,
    sentiment: false,
  });

  const imputedSet = new Set(detail.imputed_features);

  return (
    <div className="flex flex-col gap-2 text-xs">
      {FEATURE_GROUPS.map((g) => {
        const features = FEATURE_DICT.filter((f) => f.group === g);
        const open = openGroups[g];
        return (
          <div
            key={g}
            className="rounded border"
            style={{ borderColor: 'var(--color-theme-charcoal)' }}
          >
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 cursor-pointer"
              style={{ backgroundColor: 'var(--color-theme-table-header)' }}
              onClick={() => setOpenGroups((s) => ({ ...s, [g]: !s[g] }))}
            >
              <span
                className="flex items-center gap-2 text-xs font-medium"
                style={{ color: 'var(--color-theme-text-tertiary)' }}
              >
                {open ? (
                  <ChevronDown size={14} aria-hidden="true" />
                ) : (
                  <ChevronRight size={14} aria-hidden="true" />
                )}
                {tGroup(g)}
              </span>
              <span className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
                {features.length} {t('features')}
              </span>
            </button>

            {open && (
              <div className="overflow-x-auto">
                <table className="w-full text-2xs">
                  <thead>
                    <tr style={{ color: 'var(--color-theme-text-secondary)' }}>
                      <th className="text-left px-3 py-1.5 font-medium">{t('column.id')}</th>
                      <th className="text-left px-3 py-1.5 font-medium">{t('column.name')}</th>
                      <th className="text-right px-3 py-1.5 font-medium">{t('column.value')}</th>
                      <th className="text-center px-3 py-1.5 font-medium">{t('column.direction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map((f) => {
                      const value = detail.features[f.id];
                      const isImputed = imputedSet.has(f.id);
                      const tone = isImputed ? 'neutral' : featureDirectionTone(f, value);
                      const c = TONE_COLOR[tone];
                      return (
                        <tr
                          key={f.id}
                          style={{
                            borderTop: '1px solid var(--color-theme-table-border)',
                            backgroundColor: c.bg,
                          }}
                        >
                          <td className="px-3 py-1.5 font-mono">{f.id}</td>
                          <td className="px-3 py-1.5">
                            <span style={{ color: 'var(--color-theme-text-primary)' }}>
                              {f[locale]}
                            </span>
                            {isImputed && (
                              <span
                                title={t('imputedTooltip')}
                                className="inline-flex items-center ml-1.5"
                                style={{ color: '#f49f3b' }}
                              >
                                <AlertTriangle size={10} aria-hidden="true" />
                              </span>
                            )}
                          </td>
                          <td
                            className="px-3 py-1.5 text-right font-mono tabular-nums"
                            style={{ color: c.fg }}
                          >
                            {value !== undefined ? formatFeatureValue(f, value) : '—'}
                          </td>
                          <td
                            className="px-3 py-1.5 text-center"
                            style={{ color: 'var(--color-theme-text-secondary)' }}
                          >
                            <span className="inline-flex justify-center">
                              <DirectionIcon meta={f} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
