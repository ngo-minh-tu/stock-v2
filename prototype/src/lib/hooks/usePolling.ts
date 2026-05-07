'use client';

import { useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

interface Options<T> {
  intervalMs?: number;
  isTerminal: (data: T) => boolean;
  enabled: boolean;
}

interface PollingState<T> {
  data: T | null;
  error: Error | null;
  isPolling: boolean;
}

/**
 * Polls an endpoint at a fixed interval until `isTerminal(data)` returns true.
 * Cleans up on unmount, when path changes, or when disabled.
 */
export function usePolling<T>(path: string | null, options: Options<T>): PollingState<T> {
  const { intervalMs = 2000, isTerminal, enabled } = options;
  const [state, setState] = useState<PollingState<T>>({ data: null, error: null, isPolling: false });
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (!enabled || !path) {
      setState({ data: null, error: null, isPolling: false });
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    setState((s) => ({ ...s, isPolling: true }));

    const tick = async () => {
      try {
        const data = await apiFetch<T>(path);
        if (cancelledRef.current) return;
        const done = isTerminal(data);
        setState({ data, error: null, isPolling: !done });
        if (!done) timer = setTimeout(tick, intervalMs);
      } catch (e) {
        if (cancelledRef.current) return;
        setState({ data: null, error: e as Error, isPolling: false });
      }
    };
    tick();

    return () => {
      cancelledRef.current = true;
      if (timer) clearTimeout(timer);
    };
    // isTerminal is intentionally omitted: callers pass a stable predicate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, intervalMs]);

  return state;
}
