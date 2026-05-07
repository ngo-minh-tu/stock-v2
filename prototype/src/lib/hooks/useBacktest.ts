'use client';

// Cluster 5 — backtest lifecycle hooks. Two-stage pattern matching cluster 2 run polling:
//   1. POST /api/backtest → 202 + backtest_id
//   2. GET /api/backtest/{id}/status (poll until COMPLETED/FAILED)
//   3. GET /api/backtest/{id} (metrics) and /api/backtest/{id}/results (rows) when terminal

import { useCallback, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { useApiResource } from '@/lib/hooks/useApiResource';
import { usePolling } from '@/lib/hooks/usePolling';
import type {
  BacktestMetrics,
  BacktestResultsResponse,
  BacktestStartRequest,
  BacktestStartResponse,
  BacktestStatus,
  BacktestStatusResponse,
} from '@/lib/types';

const TERMINAL: ReadonlySet<BacktestStatus> = new Set(['COMPLETED', 'FAILED']);
const isTerminal = (s: BacktestStatusResponse) => TERMINAL.has(s.status);

export function useBacktest() {
  const [activeId, setActiveId] = useState<number | null>(null);

  const start = useCallback(async (input: BacktestStartRequest) => {
    const data = await apiFetch<BacktestStartResponse>('/api/backtest', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setActiveId(data.backtest_id);
    return data;
  }, []);

  const reset = useCallback(() => setActiveId(null), []);

  const polling = usePolling<BacktestStatusResponse>(
    activeId !== null ? `/api/backtest/${activeId}/status` : null,
    { intervalMs: 1500, isTerminal, enabled: activeId !== null },
  );

  const completed =
    polling.data && polling.data.status === 'COMPLETED' && activeId !== null
      ? activeId
      : null;

  // Once status hits COMPLETED, fire one-shot fetches for metrics + results.
  const metrics = useApiResource<BacktestMetrics>(
    completed !== null ? `/api/backtest/${completed}` : null,
  );
  const results = useApiResource<BacktestResultsResponse>(
    completed !== null ? `/api/backtest/${completed}/results` : null,
  );

  const isRunning = useMemo(
    () => activeId !== null && (!polling.data || !TERMINAL.has(polling.data.status)),
    [activeId, polling.data],
  );

  return {
    activeId,
    start,
    reset,
    polling,
    metrics,
    results,
    isRunning,
  };
}
