'use client';

// Radar 5 nhóm + (optional) industry-average overlay. Inline because the cluster-2 RadarChart
// is shaped for a single dataset; this one needs two series.

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RRadarChart,
  Legend,
} from 'recharts';

import { ResponsiveChart } from '@/components/charts/ResponsiveChart';
import {
  createOutwardTick,
  createRadarHoverDot,
  RadarHoverTooltip,
  type RadarHoverState,
} from '@/components/charts/radar-tooltip';
import { FeatureTable } from './FeatureTable';
import type { StockDetailResponse } from '@/lib/types';
import type { Recommendation } from '@/lib/constants';
import {
  FEATURE_BY_ID,
  type FeatureMeta,
  formatFeatureValue,
} from '@/mocks/data/feature-dict';

interface Props {
  detail: StockDetailResponse;
}

const RADAR_TICKS = [0, 25, 50, 75, 100];
type RadarGroupKey = 'fundamental' | 'technical' | 'macro' | 'realestate' | 'sentiment';

const GROUP_KEYS: RadarGroupKey[] = ['fundamental', 'technical', 'macro', 'realestate', 'sentiment'];

function recommendationTone(rec: Recommendation): 'positive' | 'neutral' | 'negative' {
  if (rec === 'MUA') return 'positive';
  if (rec === 'BAN') return 'negative';
  return 'neutral';
}

interface EvidenceItem {
  id: string;
  label: string;
  value: string;
  source: string;
}

function buildEvidence(
  detail: StockDetailResponse,
  locale: 'vi' | 'en',
  tSource: (key: string) => string,
): EvidenceItem[] {
  const preferredIds = [
    ...detail.reasons.map((r) => r.feature_id),
    'F08',
    'F10',
    'F06',
    'T08',
    'M02',
    'R04',
    'S01',
  ];
  const seen = new Set<string>();

  return preferredIds.flatMap((id) => {
    if (seen.has(id)) return [];
    seen.add(id);
    const meta = FEATURE_BY_ID[id] as FeatureMeta | undefined;
    const value = detail.features[id];
    if (!meta || typeof value !== 'number') return [];
    return [{
      id,
      label: meta[locale],
      value: formatFeatureValue(meta, value),
      source: tSource(meta.group),
    }];
  }).slice(0, 7);
}

function EvidenceLink({
  item,
  onOpenFeatures,
}: {
  item: EvidenceItem;
  onOpenFeatures: () => void;
}) {
  return (
    <a
      href={`#feature-${item.id}`}
      onClick={() => {
        onOpenFeatures();
        window.requestAnimationFrame(() => {
          document.getElementById(`feature-${item.id}`)?.scrollIntoView({
            block: 'center',
            behavior: 'smooth',
          });
        });
      }}
      className="inline-flex flex-wrap items-center gap-1 rounded px-2 py-1 no-underline"
      style={{
        border: '1px solid var(--color-theme-charcoal)',
        backgroundColor: 'var(--color-theme-tertiary)',
        color: 'var(--color-theme-text-primary)',
      }}
    >
      <span className="font-mono" style={{ color: 'var(--color-theme-text-tertiary)' }}>
        {item.id}
      </span>
      <span>{item.label}</span>
      <span className="font-mono tabular-nums" style={{ color: 'var(--ssi-ref)' }}>
        {item.value}
      </span>
      <span style={{ color: 'var(--color-theme-text-secondary)' }}>
        {item.source}
      </span>
    </a>
  );
}

function DecisionNarrative({
  detail,
  onOpenFeatures,
}: {
  detail: StockDetailResponse;
  onOpenFeatures: () => void;
}) {
  const t = useTranslations('stockDetail.breakdown.narrative');
  const tGroup = useTranslations('stockDetail.feature.group');
  const tRecommendation = useTranslations('recommendation');
  const locale = useLocale() as 'vi' | 'en';
  const radar = detail.radar;
  const sortedGroups = [...GROUP_KEYS].sort((a, b) => radar[b] - radar[a]);
  const strongest = sortedGroups[0];
  const weakest = sortedGroups[sortedGroups.length - 1];
  const tone = recommendationTone(detail.scoring.recommendation);
  const evidence = buildEvidence(detail, locale, (key) => t(`source.${key}`));
  const radarAverage = GROUP_KEYS.reduce((sum, key) => sum + radar[key], 0) / GROUP_KEYS.length;
  const radarSpread = radar[strongest] - radar[weakest];
  const imputedCount = detail.imputed_features?.length ?? 0;

  return (
    <div
      className="border-t pt-4 text-xs leading-relaxed flex flex-col"
      style={{ borderColor: 'var(--color-theme-charcoal)' }}
    >
      <h3
        className="text-sm font-medium mb-2"
        style={{ color: 'var(--color-theme-text-tertiary)' }}
      >
        {t('title')}
      </h3>
      <div className="flex flex-col">
        <section className="py-3">
          <div className="font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('inputsTitle')}
          </div>
          <p className="mb-2" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('inputsBody', {
              strongest: tGroup(strongest),
              strongestScore: radar[strongest].toFixed(1),
              weakest: tGroup(weakest),
              weakestScore: radar[weakest].toFixed(1),
            })}
          </p>
          <div className="font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('evidenceTitle')}
          </div>
          <div className="flex flex-wrap gap-2">
            {evidence.map((item) => (
              <EvidenceLink key={item.id} item={item} onOpenFeatures={onOpenFeatures} />
            ))}
          </div>
        </section>

        <section className="py-3 border-t" style={{ borderColor: 'var(--color-theme-charcoal)' }}>
          <div className="font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('decisionTitle', { recommendation: tRecommendation(detail.scoring.recommendation) })}
          </div>
          <p style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t(`decision.${tone}`, {
              score: detail.scoring.ai_score,
              upside: detail.scoring.upside_pct.toFixed(1),
              confidence: detail.scoring.confidence,
              strongest: tGroup(strongest),
              strongestScore: radar[strongest].toFixed(1),
              weakest: tGroup(weakest),
              weakestScore: radar[weakest].toFixed(1),
              radarAverage: radarAverage.toFixed(1),
              spread: radarSpread.toFixed(1),
              warnings: detail.risk.warning_badges.length,
              imputed: imputedCount,
            })}
          </p>
        </section>

        <section className="py-3 border-t" style={{ borderColor: 'var(--color-theme-charcoal)' }}>
          <div className="font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('flowTitle')}
          </div>
          <p style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t(`flow.${tone}`, {
              recommendation: tRecommendation(detail.scoring.recommendation),
              warnings: detail.risk.warning_badges.length,
            })}
          </p>
        </section>
      </div>
    </div>
  );
}

export function ScoreBreakdown({ detail }: Props) {
  const t = useTranslations('stockDetail.breakdown');
  const tGroup = useTranslations('stockDetail.feature.group');
  const [showFeatures, setShowFeatures] = useState(false);
  const [hover, setHover] = useState<RadarHoverState | null>(null);

  const radar = detail.radar;
  const ind = detail.radar_industry_avg;

  const points = [
    { axis: tGroup('fundamental'), ticker: radar.fundamental, industry: ind?.fundamental ?? 0 },
    { axis: tGroup('technical'), ticker: radar.technical, industry: ind?.technical ?? 0 },
    { axis: tGroup('macro'), ticker: radar.macro, industry: ind?.macro ?? 0 },
    { axis: tGroup('realestate'), ticker: radar.realestate, industry: ind?.realestate ?? 0 },
    { axis: tGroup('sentiment'), ticker: radar.sentiment, industry: ind?.sentiment ?? 0 },
  ];

  const tickerSeriesName = t('legend.ticker', { ticker: detail.ticker });
  const industrySeriesName = t('legend.industry');

  const axes = points.map((p) => p.axis);
  const renderTickerDot = createRadarHoverDot({
    axes,
    color: 'var(--ssi-up)',
    onHover: setHover,
    seriesName: tickerSeriesName,
    values: points.map((p) => p.ticker),
    valueKey: 'ticker',
  });
  const renderIndustryDot = createRadarHoverDot({
    axes,
    color: 'var(--color-theme-text-secondary)',
    onHover: setHover,
    seriesName: industrySeriesName,
    values: points.map((p) => p.industry),
    valueKey: 'industry',
  });

  return (
    <section className="card p-4 flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('title')}
          </h2>
          <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('subtitle', { availability: detail.feature_availability })}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost text-2xs px-2 py-1"
          onClick={() => setShowFeatures((v) => !v)}
        >
          {showFeatures ? t('hideFeatures') : t('showFeatures')}
        </button>
      </header>

      <div
        className="relative"
        style={{ width: '100%', maxWidth: 480, height: 400, alignSelf: 'center' }}
      >
        <ResponsiveChart>
          <RRadarChart data={points} outerRadius="72%" cx="50%" cy="50%">
            <PolarGrid
              gridType="polygon"
              stroke="var(--color-theme-charcoal)"
            />
            <PolarAngleAxis dataKey="axis" tick={createOutwardTick(axes, 6)} />
            <PolarRadiusAxis
              type="number"
              angle={45}
              domain={[0, 100]}
              ticks={RADAR_TICKS as never}
              tickCount={RADAR_TICKS.length}
              allowDataOverflow={false}
              tick={{ fill: 'var(--color-theme-text-secondary)', fontSize: 9 }}
              stroke="var(--color-theme-charcoal)"
            />
            {ind && (
              <Radar
                name={industrySeriesName}
                dataKey="industry"
                stroke="var(--color-theme-text-secondary)"
                fill="var(--color-theme-text-secondary)"
                fillOpacity={0.12}
                isAnimationActive={false}
                dot={renderIndustryDot}
                activeDot={false}
              />
            )}
            <Radar
              name={tickerSeriesName}
              dataKey="ticker"
              stroke="var(--ssi-up)"
              fill="var(--ssi-up)"
              fillOpacity={0.45}
              isAnimationActive={false}
              dot={renderTickerDot}
              activeDot={false}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--color-theme-text-secondary)' }}
            />
          </RRadarChart>
        </ResponsiveChart>
        <RadarHoverTooltip state={hover} valueLabel={t('scoreLabel')} />
      </div>

      <DecisionNarrative detail={detail} onOpenFeatures={() => setShowFeatures(true)} />

      {showFeatures && <FeatureTable detail={detail} />}
    </section>
  );
}
