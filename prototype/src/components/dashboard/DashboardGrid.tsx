'use client';

import { useTranslations } from 'next-intl';

import { BarChart } from '@/components/charts/BarChart';
import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { PieChart } from '@/components/charts/PieChart';
import { RadarChart } from '@/components/charts/RadarChart';
import { TreemapChart } from '@/components/charts/TreemapChart';
import type { DashboardResponse } from '@/lib/types';

import { KPICards } from './KPICards';

export function DashboardGrid({ data }: { data: DashboardResponse }) {
  const t = useTranslations('dashboard.chart');

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

        <ChartCard title={t('pie.title')} subtitle={t('pie.subtitle')} height={260}>
          <PieChart data={data.pie} />
        </ChartCard>

        <ChartCard title={t('radar.title')} subtitle={t('radar.subtitle')} height={260}>
          <RadarChart data={data.radar} />
        </ChartCard>

        <ChartCard
          title={t('line.title')}
          subtitle={t('line.subtitle')}
          height={260}
          className="lg:col-span-2"
        >
          <LineChart data={data.line.points} />
        </ChartCard>

        <ChartCard
          title={t('bar.title')}
          subtitle={t('bar.subtitle')}
          height={260}
          className="lg:col-span-2"
        >
          <BarChart data={data.bar} />
        </ChartCard>
      </div>
    </div>
  );
}
