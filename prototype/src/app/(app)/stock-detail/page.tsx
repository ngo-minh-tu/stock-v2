'use client';

// Stock Detail page — 5 sections wired together.
// URL contract: /stock-detail?run_id=X&ticker=Y (set by Top MUA expand row).

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { CandlestickChart, type CandlePeriod } from '@/components/stock-detail/CandlestickChart';
import { EntrySignalPanel } from '@/components/stock-detail/EntrySignalPanel';
import { RiskPanel } from '@/components/stock-detail/RiskPanel';
import { ScoreBreakdown } from '@/components/stock-detail/ScoreBreakdown';
import { StockHeader } from '@/components/stock-detail/StockHeader';
import { useRun } from '@/contexts/RunContext';
import { useApiResource } from '@/lib/hooks/useApiResource';
import {
  useStockDetail,
  useStockPrices,
  useTickerRuns,
} from '@/lib/hooks/useStockDetail';
import type { RunSummary } from '@/lib/types';

export default function StockDetailPage() {
  const t = useTranslations('stockDetail');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryRunId = searchParams.get('run_id');
  const queryTicker = searchParams.get('ticker');

  const { lastCompletedRunId } = useRun();

  // Reload run-scoped data when a new run completes (mirrors Dashboard / TopMUA).
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (lastCompletedRunId) setReloadKey((k) => k + 1);
  }, [lastCompletedRunId]);

  const ticker = queryTicker?.toUpperCase() ?? null;
  const runId = queryRunId ?? lastCompletedRunId ?? null;

  const detailRes = useStockDetail(runId, ticker, reloadKey);
  const tickerRunsRes = useTickerRuns(ticker, reloadKey);
  const summaryRes = useApiResource<RunSummary>(
    runId ? `/api/runs/${runId}` : null,
    reloadKey,
  );

  const [period, setPeriod] = useState<CandlePeriod>('6M');
  const pricesRes = useStockPrices(ticker, period, reloadKey);

  const handleSelectRun = (newRunId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('run_id', newRunId);
    router.push(`/stock-detail?${params.toString()}`);
  };

  const overlays = useMemo(() => {
    if (!detailRes.data) return null;
    return {
      support: detailRes.data.entry.support_zone,
      resistance: detailRes.data.entry.resistance_zone,
      stop_loss: detailRes.data.risk.stop_loss_price,
      target_3m: detailRes.data.scoring.target_price_3m,
    };
  }, [detailRes.data]);

  // No ticker in URL — direct nav. Show a hint.
  if (!ticker) {
    return (
      <div className="card p-6 text-sm">
        <h1 className="text-xl font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {tNav('stockDetail')}
        </h1>
        <p>{t('missingTicker')}</p>
      </div>
    );
  }

  if (detailRes.loading) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
        <Loader2 size={14} aria-hidden="true" className="animate-spin" />
        {t('loading')}
      </div>
    );
  }

  if (detailRes.error || !detailRes.data) {
    return (
      <div className="card p-6 text-sm" style={{ borderColor: 'var(--ssi-down)' }}>
        <h1 className="text-base font-medium mb-2" style={{ color: 'var(--ssi-down)' }}>
          {t('errorTitle')}
        </h1>
        <p>{detailRes.error?.message ?? t('errorBody')}</p>
      </div>
    );
  }

  const detail = detailRes.data;
  const totalCapital = summaryRes.data?.total_capital ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <StockHeader
        detail={detail}
        runs={tickerRunsRes.data?.items ?? []}
        selectedRunId={detail.run_id}
        onSelectRun={handleSelectRun}
      />

      {overlays && pricesRes.data && (
        <CandlestickChart
          bars={pricesRes.data.bars}
          overlays={overlays}
          period={period}
          onPeriodChange={setPeriod}
          loading={pricesRes.loading}
        />
      )}

      <ScoreBreakdown detail={detail} />

      <EntrySignalPanel detail={detail} />

      <RiskPanel detail={detail} totalCapital={totalCapital} />
    </div>
  );
}
