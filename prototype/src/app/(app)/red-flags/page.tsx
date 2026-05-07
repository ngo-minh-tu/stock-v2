'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { RedFlagsBadgesTable } from '@/components/tables/RedFlagsBadgesTable';
import { RedFlagsExcludedTable } from '@/components/tables/RedFlagsExcludedTable';
import { useRun } from '@/contexts/RunContext';
import { useApiResource } from '@/lib/hooks/useApiResource';
import type { RunResultsResponse, RunsListResponse } from '@/lib/types';

export default function RedFlagsPage() {
  const t = useTranslations('redFlags');
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
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {tNav('redFlags')}
        </h1>
        {runId && (
          <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            Run: {runId}
          </p>
        )}
      </header>

      {(runsRes.loading || resultsRes.loading) && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          {t('loading')}
        </div>
      )}

      {!runId && !runsRes.loading && (
        <div className="card p-6 text-sm">{t('noRun')}</div>
      )}

      {resultsRes.data && (
        <>
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
                {t('section.excluded.title')}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-theme-text-secondary)' }}>
                {t('section.excluded.description')}
              </p>
            </div>
            <RedFlagsExcludedTable excluded={resultsRes.data.excluded} />
          </section>

          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
                {t('section.warnings.title')}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-theme-text-secondary)' }}>
                {t('section.warnings.description')}
              </p>
            </div>
            <RedFlagsBadgesTable results={resultsRes.data.results} />
          </section>
        </>
      )}
    </div>
  );
}
