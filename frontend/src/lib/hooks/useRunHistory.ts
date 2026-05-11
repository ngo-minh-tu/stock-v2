'use client';

// Cluster 5 — Run History list + compare hooks.

import { useCallback, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type { CompareResponse, RunsListResponse } from '@/lib/types';

import { useApiResource } from './useApiResource';

export function useRunsList(limit = 10, offset = 0) {
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const path = `/api/runs?limit=${limit}&offset=${offset}`;
  const list = useApiResource<RunsListResponse>(path, reloadKey);

  const remove = useCallback(
    async (run_id: string): Promise<void> => {
      await apiFetch<{ deleted: boolean }>(`/api/runs/${encodeURIComponent(run_id)}`, {
        method: 'DELETE',
      });
      reload();
    },
    [reload],
  );

  return { list, remove, reload };
}

export function useCompare(run_a: string | null, run_b: string | null) {
  // Path is null until both ids are set — useApiResource then no-ops.
  const path =
    run_a && run_b && run_a !== run_b
      ? `/api/runs/${encodeURIComponent(run_a)}/compare/${encodeURIComponent(run_b)}`
      : null;
  return useApiResource<CompareResponse>(path);
}
