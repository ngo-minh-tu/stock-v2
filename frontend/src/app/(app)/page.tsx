'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { InfoBanner } from '@/components/common/InfoBanner';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { ExportPdfButton } from '@/components/export/ExportPdfButton';
import { RunButton } from '@/components/run/RunButton';
import { RunSelector } from '@/components/run/RunSelector';
import { ShareButton } from '@/components/share/ShareButton';
import { useRun } from '@/contexts/RunContext';
import { useApiResource } from '@/lib/hooks/useApiResource';
import type { DashboardResponse, RunResultsResponse, RunsListResponse } from '@/lib/types';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryRunId = searchParams.get('run_id');

  const { lastCompletedRunId } = useRun();

  // Reload runs list when a new run completes (RunContext bumps lastCompletedRunId).
  const [runsReloadKey, setRunsReloadKey] = useState(0);
  useEffect(() => {
    if (lastCompletedRunId) setRunsReloadKey((k) => k + 1);
  }, [lastCompletedRunId]);

  const runsRes = useApiResource<RunsListResponse>('/api/runs?limit=10', runsReloadKey);

  // Resolve which run to load: URL param > most recent completed > newest with computed.
  const selectedRunId = useMemo(() => {
    if (queryRunId) return queryRunId;
    if (lastCompletedRunId) return lastCompletedRunId;
    const items = runsRes.data?.items ?? [];
    return items[0]?.run_id ?? null;
  }, [queryRunId, lastCompletedRunId, runsRes.data]);

  const dashboardRes = useApiResource<DashboardResponse>(
    selectedRunId ? `/api/runs/${selectedRunId}/dashboard` : null,
    runsReloadKey,
  );
  const resultsRes = useApiResource<RunResultsResponse>(
    selectedRunId ? `/api/runs/${selectedRunId}/results` : null,
    runsReloadKey,
  );

  const handleSelect = (runId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('run_id', runId);
    router.push(`/?${params.toString()}`);
  };

  // Empty state — no runs at all. Inline RunButton reuses the capital modal flow.
  const noRuns = !runsRes.loading && (runsRes.data?.items.length ?? 0) === 0;
  if (noRuns) {
    return (
      <section className="flex flex-col items-center justify-center text-center py-24 gap-4">
        <h1 className="text-2xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {tNav('dashboard')}
        </h1>
        <p className="max-w-md text-sm">{t('empty.message')}</p>
        <RunButton />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1
            className="text-xl font-medium"
            style={{ color: 'var(--color-theme-text-tertiary)' }}
          >
            {tNav('dashboard')}
          </h1>
          {selectedRunId && (
            <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('runId', { id: selectedRunId })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportPdfButton runId={selectedRunId} />
          <ShareButton runId={selectedRunId} />
          {runsRes.data && selectedRunId && (
            <RunSelector
              runs={runsRes.data.items}
              selectedRunId={selectedRunId}
              onSelect={handleSelect}
            />
          )}
        </div>
      </header>

      <InfoBanner
        testId="dashboard-disclaimer"
        storageKey="dashboard-disclaimer-v1"
        text={t('disclaimer')}
      />

      {dashboardRes.loading && (
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          {t('loading')}
        </div>
      )}

      {dashboardRes.error && (
        <div className="card p-4 text-sm" style={{ borderColor: 'var(--ssi-down)' }}>
          {t('errorLoad')}
        </div>
      )}

      {dashboardRes.data && (
        <DashboardGrid data={dashboardRes.data} results={resultsRes.data?.results} />
      )}
    </div>
  );
}
