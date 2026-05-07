'use client';

// RunContext — single source of truth for the currently-running screening job.
// Header's RunButton, AppShell's floating RunStatusCard, and Dashboard auto-load all share this.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, JobConflictError, apiFetch } from '@/lib/api';
import { RUN_TERMINAL_STATES, type MockRunOutcome } from '@/lib/constants';
import { usePolling } from '@/lib/hooks/usePolling';
import type { RunStartResponse, RunStatusResponse } from '@/lib/types';

import { useToast } from './ToastContext';

interface RunContextValue {
  /** Active run id during start/poll. Null when idle or after auto-dismiss. */
  activeRunId: string | null;
  /** Most recent status payload while polling. */
  status: RunStatusResponse | null;
  /** True from POST until terminal status. */
  isRunning: boolean;
  /** Latest completed run id, set after a successful poll terminal — Dashboard listens. */
  lastCompletedRunId: string | null;
  /** Trigger a run via mock API. */
  startRun: (args: { totalCapital: number; outcome: MockRunOutcome }) => Promise<void>;
  /** Manually clear the floating card (auto-dismiss handles the success path). */
  dismiss: () => void;
}

const RunContext = createContext<RunContextValue | null>(null);

const isTerminalStatus = (s: RunStatusResponse) => RUN_TERMINAL_STATES.has(s.status);

export function RunProvider({ children }: { children: React.ReactNode }) {
  const { push } = useToast();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [lastCompletedRunId, setLastCompletedRunId] = useState<string | null>(null);

  // Track which run we have already fired terminal-side-effects for. Using a ref (not state)
  // keeps the side-effect effect from re-running and clearing its own auto-dismiss timer.
  const handledRunRef = useRef<string | null>(null);

  const polling = usePolling<RunStatusResponse>(
    activeRunId ? `/api/runs/${activeRunId}/status` : null,
    { intervalMs: 2000, isTerminal: isTerminalStatus, enabled: Boolean(activeRunId) },
  );

  // Fire toasts + auto-dismiss exactly once per run completion.
  // Note: the dismissal timer uses a functional setState comparing against the captured run id,
  // so a late-firing timer for run A cannot blank an already-started run B.
  useEffect(() => {
    const status = polling.data;
    if (!status || !activeRunId) return;
    if (handledRunRef.current === activeRunId) return;
    if (!RUN_TERMINAL_STATES.has(status.status)) return;

    handledRunRef.current = activeRunId;
    const capturedRunId = activeRunId;

    if (status.status === 'FAILED') {
      push({
        kind: 'error',
        title: 'Run thất bại',
        message: status.run_error ?? 'Đã xảy ra lỗi không xác định.',
      });
    } else if (status.status === 'COMPLETED_WITH_WARNINGS') {
      push({
        kind: 'warning',
        title: 'Hoàn thành với cảnh báo',
        message: `${status.warnings.length} cảnh báo phát sinh trong run.`,
      });
      setLastCompletedRunId(capturedRunId);
    } else {
      push({
        kind: 'success',
        title: 'Run hoàn thành',
        message: 'Dashboard đang tải kết quả mới…',
      });
      setLastCompletedRunId(capturedRunId);
    }

    const delay = status.status === 'FAILED' ? 4000 : 3000;
    const timer = setTimeout(() => {
      setActiveRunId((prev) => (prev === capturedRunId ? null : prev));
    }, delay);
    return () => clearTimeout(timer);
  }, [polling.data, activeRunId, push]);

  const startRun = useCallback(
    async ({ totalCapital, outcome }: { totalCapital: number; outcome: MockRunOutcome }) => {
      try {
        const path = `/api/run${outcome === 'success' ? '' : `?outcome=${outcome}`}`;
        const data = await apiFetch<RunStartResponse>(path, {
          method: 'POST',
          body: JSON.stringify({ total_capital: totalCapital }),
        });
        // Reset terminal-handled tracker so the new run's completion fires side-effects.
        handledRunRef.current = null;
        setActiveRunId(data.run_id);
      } catch (e) {
        if (e instanceof JobConflictError) {
          push({ kind: 'warning', title: 'Đang có tác vụ chạy', message: e.message });
          return;
        }
        const msg = e instanceof ApiError ? e.message : 'Không thể bắt đầu run.';
        push({ kind: 'error', title: 'Lỗi', message: msg });
      }
    },
    [push],
  );

  const dismiss = useCallback(() => setActiveRunId(null), []);

  const value = useMemo<RunContextValue>(
    () => ({
      activeRunId,
      status: polling.data,
      isRunning:
        Boolean(activeRunId) && !(polling.data && RUN_TERMINAL_STATES.has(polling.data.status)),
      lastCompletedRunId,
      startRun,
      dismiss,
    }),
    [activeRunId, polling.data, lastCompletedRunId, startRun, dismiss],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun must be used within RunProvider');
  return ctx;
}
