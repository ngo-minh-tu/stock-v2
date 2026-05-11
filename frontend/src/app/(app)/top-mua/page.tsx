'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ExportPdfButton } from '@/components/export/ExportPdfButton';
import { ShareButton } from '@/components/share/ShareButton';
import { TopMuaTable } from '@/components/tables/TopMuaTable';
import { useRun } from '@/contexts/RunContext';
import { useApiResource } from '@/lib/hooks/useApiResource';
import type { RunResultsResponse, RunsListResponse } from '@/lib/types';

export default function TopMuaPage() {
  const t = useTranslations('topMua');
  const tNav = useTranslations('nav');
  const searchParams = useSearchParams();
  const queryRunId = searchParams.get('run_id');
  const { lastCompletedRunId } = useRun();

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (lastCompletedRunId) setReloadKey((k) => k + 1);
  }, [lastCompletedRunId]);

  const runsRes = useApiResource<RunsListResponse>('/api/runs?limit=1', reloadKey);
  const runId = useMemo(() => {
    if (queryRunId) return queryRunId;
    if (lastCompletedRunId) return lastCompletedRunId;
    return runsRes.data?.items[0]?.run_id ?? null;
  }, [queryRunId, lastCompletedRunId, runsRes.data]);

  const resultsRes = useApiResource<RunResultsResponse>(
    runId ? `/api/runs/${runId}/results` : null,
    reloadKey,
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {tNav('topMua')}
          </h1>
          {runId && (
            <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
              Run: {runId}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportPdfButton runId={runId} label={t('exportPdfTopMua')} />
          <ShareButton runId={runId} />
        </div>
      </header>

      {!runId && !runsRes.loading && (
        <div className="card p-6 text-sm">{t('noRun')}</div>
      )}

      {(runsRes.loading || resultsRes.loading) && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          {t('loading')}
        </div>
      )}

      {resultsRes.data && runId && (
        <TopMuaTable results={resultsRes.data.results} runId={runId} />
      )}
    </div>
  );
}
