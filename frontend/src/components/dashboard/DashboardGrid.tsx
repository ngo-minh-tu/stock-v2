'use client';

import { useTranslations } from 'next-intl';

import { BarChart } from '@/components/charts/BarChart';
import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { PieChart } from '@/components/charts/PieChart';
import { RadarChart } from '@/components/charts/RadarChart';
import { TreemapChart } from '@/components/charts/TreemapChart';
import { TopMuaTable } from '@/components/tables/TopMuaTable';
import type { Recommendation } from '@/lib/constants';
import type { DashboardResponse, ScreeningResult } from '@/lib/types';

import { KPICards } from './KPICards';

function formatSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function DashboardGrid({
  data,
  results,
}: {
  data: DashboardResponse;
  results?: ScreeningResult[];
}) {
  const t = useTranslations('dashboard.chart');
  const tRecommendation = useTranslations('recommendation');
  const tGroup = useTranslations('stockDetail.feature.group');
  const recommendationSections: Recommendation[] = results?.some((r) => r.recommendation === 'MUA')
    ? ['MUA', 'GIU', 'BAN']
    : ['GIU', 'BAN'];
  const pieTotal = data.pie.reduce((sum, item) => sum + item.count, 0);
  const pieLeader = [...data.pie].sort((a, b) => b.count - a.count)[0];
  const pieBuy = data.pie.find((item) => item.recommendation === 'MUA')?.count ?? 0;
  const pieHold = data.pie.find((item) => item.recommendation === 'GIU')?.count ?? 0;
  const pieSell = data.pie.find((item) => item.recommendation === 'BAN')?.count ?? 0;
  const radarEntries = Object.entries(data.radar) as [keyof typeof data.radar, number][];
  const [radarStrongest, radarWeakest] = [...radarEntries].sort((a, b) => b[1] - a[1]);
  const lineFirst = data.line.points[0];
  const lineLast = data.line.points[data.line.points.length - 1];
  const vnindexChange = lineFirst && lineLast ? lineLast.vnindex - lineFirst.vnindex : 0;
  const sectorChange = lineFirst && lineLast ? lineLast.sector - lineFirst.sector : 0;
  const sectorVsMarket = sectorChange - vnindexChange;
  const barTop = data.bar[0];
  const barAvg = data.bar.length
    ? data.bar.reduce((sum, item) => sum + item.ai_score, 0) / data.bar.length
    : 0;
  const barBuyCount = data.bar.filter((item) => item.recommendation === 'MUA').length;

  const pieInsight = pieLeader
    ? t('pie.insight', {
        leader: tRecommendation(pieLeader.recommendation),
        leaderCount: pieLeader.count,
        total: pieTotal,
        buy: pieBuy,
        hold: pieHold,
        sell: pieSell,
      })
    : t('pie.insightEmpty');
  const radarInsight = t('radar.insight', {
    strongest: tGroup(radarStrongest[0]),
    strongestScore: radarStrongest[1].toFixed(1),
    weakest: tGroup(radarWeakest[0]),
    weakestScore: radarWeakest[1].toFixed(1),
    fundamental: data.radar.fundamental.toFixed(1),
    technical: data.radar.technical.toFixed(1),
    macro: data.radar.macro.toFixed(1),
    realestate: data.radar.realestate.toFixed(1),
    sentiment: data.radar.sentiment.toFixed(1),
  });
  const lineInsight = t('line.insight', {
    vnindex: formatSigned(vnindexChange),
    sector: formatSigned(sectorChange),
    spread: formatSigned(sectorVsMarket),
  });
  const barInsight = barTop
    ? t('bar.insight', {
        ticker: barTop.ticker,
        topScore: barTop.ai_score.toFixed(2),
        avgScore: barAvg.toFixed(2),
        buyCount: barBuyCount,
        total: data.bar.length,
      })
    : t('bar.insightEmpty');

  return (
    <div className="flex flex-col gap-4">
      <KPICards kpi={data.kpi} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title={t('treemap.title')}
          subtitle={t('treemap.subtitle')}
          height={320}
          className="lg:col-span-2"
        >
          <TreemapChart data={data.treemap} />
        </ChartCard>

        {results && (
          <div className="lg:col-span-2 flex flex-col gap-4">
            {recommendationSections.map((recommendation) => (
              <TopMuaTable
                key={recommendation}
                results={results}
                runId={data.run_id}
                recommendation={recommendation}
                showTitle
                tickerAction="detail"
              />
            ))}
          </div>
        )}

        <ChartCard
          title={t('pie.title')}
          subtitle={t('pie.subtitle')}
          height={260}
          footer={pieInsight}
        >
          <PieChart data={data.pie} />
        </ChartCard>

        <ChartCard
          title={t('radar.title')}
          subtitle={t('radar.subtitle')}
          height={260}
          footer={radarInsight}
        >
          <RadarChart data={data.radar} />
        </ChartCard>

        <ChartCard
          title={t('line.title')}
          subtitle={t('line.subtitle')}
          height={260}
          className="lg:col-span-2"
          footer={lineInsight}
        >
          <LineChart data={data.line.points} />
        </ChartCard>

        <ChartCard
          title={t('bar.title')}
          subtitle={t('bar.subtitle')}
          height={260}
          className="lg:col-span-2"
          footer={barInsight}
        >
          <BarChart data={data.bar} />
        </ChartCard>
      </div>
    </div>
  );
}
