'use client';

// Cluster 5 — portfolio CRUD wrapper. List via useApiResource; mutate via apiFetch with manual reload.

import { useCallback, useState } from 'react';

import { apiFetch } from '@/lib/api';
import type {
  PortfolioCreateRequest,
  PortfolioHolding,
  PortfolioListResponse,
  PortfolioUpdateRequest,
} from '@/lib/types';

import { useApiResource } from './useApiResource';

export function usePortfolio() {
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const list = useApiResource<PortfolioListResponse>('/api/portfolio', reloadKey);

  const add = useCallback(
    async (input: PortfolioCreateRequest): Promise<PortfolioHolding> => {
      const data = await apiFetch<PortfolioHolding>('/api/portfolio', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      reload();
      return data;
    },
    [reload],
  );

  const update = useCallback(
    async (id: number, input: PortfolioUpdateRequest): Promise<PortfolioHolding> => {
      const data = await apiFetch<PortfolioHolding>(`/api/portfolio/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      reload();
      return data;
    },
    [reload],
  );

  const remove = useCallback(
    async (id: number): Promise<void> => {
      await apiFetch<{ deleted: boolean }>(`/api/portfolio/${id}`, { method: 'DELETE' });
      reload();
    },
    [reload],
  );

  return { list, add, update, remove, reload };
}
