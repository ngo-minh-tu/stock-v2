'use client';

import { Loader2, PlayCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { BacktestModal } from '@/components/backtest/BacktestModal';
import { BacktestResultCard } from '@/components/backtest/BacktestResultCard';
import { InfoBanner } from '@/components/common/InfoBanner';
import { ComparePanel } from '@/components/run-history/ComparePanel';
import { DeleteRunModal } from '@/components/run-history/DeleteRunModal';
import { RunHistoryKPI } from '@/components/run-history/RunHistoryKPI';
import { RunHistoryTable } from '@/components/run-history/RunHistoryTable';
import { useToast } from '@/contexts/ToastContext';
import { useBacktest } from '@/lib/hooks/useBacktest';
import { useCompare, useRunsList } from '@/lib/hooks/useRunHistory';
import type { RunSummary } from '@/lib/types';

export default function RunHistoryPage() {
  const t = useTranslations('runHistory');
  const tNav = useTranslations('nav');
  const tBack = useTranslations('backtest');
  const router = useRouter();
  const { push } = useToast();

  const runsRes = useRunsList(10, 0);

  // Compare selection — A & B run ids, in selection order. Cluster prompt §4.3.
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const compare = useCompare(compareA, compareB);

  const [deleteTarget, setDeleteTarget] = useState<RunSummary | null>(null);

  // Backtest lifecycle.
  const backtest = useBacktest();
  const [backtestOpen, setBacktestOpen] = useState(false);

  const items = useMemo(() => runsRes.list.data?.items ?? [], [runsRes.list.data]);

  const handleView = useCallback(
    (run_id: string) => {
      router.push(`/?run_id=${encodeURIComponent(run_id)}`);
    },
    [router],
  );

  const handleCompareToggle = useCallback(
    (run_id: string) => {
      // Toggle behaviour: clicking same row twice clears it from the pair.
      if (compareA === run_id) {
        setCompareA(compareB);
        setCompareB(null);
        return;
      }
      if (compareB === run_id) {
        setCompareB(null);
        return;
      }
      if (compareA === null) {
        setCompareA(run_id);
        return;
      }
      setCompareB(run_id);
    },
    [compareA, compareB],
  );

  const clearCompare = useCallback(() => {
    setCompareA(null);
    setCompareB(null);
  }, []);

  const handleDelete = useCallback((row: RunSummary) => {
    setDeleteTarget(row);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.run_id;
    await runsRes.remove(id);
    // Drop the deleted run from compare selection so the panel doesn't request stale ids.
    if (compareA === id) setCompareA(null);
    if (compareB === id) setCompareB(null);
    push({
      kind: 'success',
      title: t('toast.deleteSuccess.title'),
      message: t('toast.deleteSuccess.body', { runId: id }),
    });
    setDeleteTarget(null);
  }, [deleteTarget, runsRes, push, t, compareA, compareB]);

  const handleBacktestSubmit = useCallback(
    async (input: { period_from: string; period_to: string }) => {
      await backtest.start(input);
      setBacktestOpen(false);
      push({
        kind: 'info',
        title: tBack('toast.startTitle'),
        message: tBack('toast.startBody', { from: input.period_from, to: input.period_to }),
      });
    },
    [backtest, push, tBack],
  );

  // KPI block — total runs, last run timestamp, accuracy from latest backtest if any.
  const kpi = useMemo(
    () => ({
      totalRuns: runsRes.list.data?.total ?? items.length,
      lastRunAt: items[0]?.run_at ?? null,
      lastAccuracyPct: backtest.metrics.data
        ? backtest.metrics.data.recommendation_accuracy * 100
        : null,
    }),
    [runsRes.list.data, items, backtest.metrics.data],
  );

  // Compare panel hint — show when fewer than 2 runs are selected.
  const compareHint = useMemo(() => {
    if (compareA && compareB) return null;
    if (compareA) return t('compare.hintNeedB');
    return t('compare.hintNeedAB');
  }, [compareA, compareB, t]);

  const loading = runsRes.list.loading;
  const empty = !loading && items.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {tNav('runHistory')}
          </h1>
          <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setBacktestOpen(true)}
          disabled={backtest.isRunning || empty}
          title={empty ? t('backtestDisabledNoRun') : undefined}
        >
          <PlayCircle size={14} aria-hidden="true" />
          {backtest.isRunning ? tBack('button.running') : tBack('button.start')}
        </button>
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          {t('loading')}
        </div>
      )}

      {!loading && runsRes.list.error && (
        <div className="card p-4 text-sm" style={{ borderColor: 'var(--ssi-down)' }}>
          {t('errorLoad')}
        </div>
      )}

      {!loading && empty && (
        <div className="card p-8 flex flex-col items-center justify-center text-center gap-3">
          <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('empty.title')}
          </h2>
          <p className="text-2xs max-w-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('empty.hint')}
          </p>
        </div>
      )}

      {!loading && !empty && (
        <>
          <RunHistoryKPI
            totalRuns={kpi.totalRuns}
            lastRunAt={kpi.lastRunAt}
            lastAccuracyPct={kpi.lastAccuracyPct}
          />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 flex flex-col gap-3">
              <RunHistoryTable
                rows={items}
                selectedA={compareA}
                selectedB={compareB}
                onView={handleView}
                onCompareToggle={handleCompareToggle}
                onDelete={handleDelete}
              />
            </div>
            <div className="xl:col-span-1">
              <ComparePanel
                data={compare.data}
                loading={compare.loading}
                error={compare.error}
                hint={compareHint}
                onClear={clearCompare}
              />
            </div>
          </div>

          {/* Backtest progress / result */}
          {backtest.activeId !== null && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
                {tBack('section.title')}
              </h2>

              <InfoBanner
                testId="backtest-disclaimer"
                storageKey="backtest-disclaimer-v1"
                text={tBack('disclaimer')}
              />

              {backtest.isRunning && (
                <div className="card p-4 flex items-center gap-3">
                  <Loader2 size={14} aria-hidden="true" className="animate-spin" />
                  <span className="text-xs">{tBack('button.running')}</span>
                </div>
              )}

              {!backtest.isRunning && backtest.metrics.data && backtest.results.data && (
                <BacktestResultCard
                  metrics={backtest.metrics.data}
                  results={backtest.results.data.results}
                />
              )}

              {!backtest.isRunning && backtest.polling.data?.status === 'FAILED' && (
                <div className="card p-4 text-sm" style={{ borderColor: 'var(--ssi-down)' }}>
                  {tBack('failed')}
                </div>
              )}
            </section>
          )}
        </>
      )}

      <DeleteRunModal
        open={deleteTarget !== null}
        runId={deleteTarget?.run_id ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <BacktestModal
        open={backtestOpen}
        onClose={() => setBacktestOpen(false)}
        onSubmit={handleBacktestSubmit}
      />
    </div>
  );
}
