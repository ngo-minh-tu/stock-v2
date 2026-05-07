'use client';

// Cluster 6 §4 — POST /api/share, regenerate, list active links, revoke.
// Single hook used by ShareLinkModal (creator) and ShareLinksManagement (Settings).

import { useCallback, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api';
import { useApiResource } from '@/lib/hooks/useApiResource';
import type {
  ShareCreateResponse,
  ShareLink,
  ShareListResponse,
} from '@/lib/types';

interface CreateState {
  loading: boolean;
  error: string | null;
  link: ShareLink | null;
}

const DEFAULT_EXPIRES_IN_DAYS = 7;

export function useShareCreate() {
  const [state, setState] = useState<CreateState>({ loading: false, error: null, link: null });

  const create = useCallback(async (run_id: string, expires_in_days = DEFAULT_EXPIRES_IN_DAYS) => {
    setState({ loading: true, error: null, link: null });
    try {
      const link = await apiFetch<ShareCreateResponse>('/api/share', {
        method: 'POST',
        body: JSON.stringify({ run_id, expires_in_days }),
      });
      setState({ loading: false, error: null, link });
      return link;
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Không tạo được link.';
      setState({ loading: false, error: message, link: null });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, link: null });
  }, []);

  return { ...state, create, reset };
}

/** Settings management: list active links + revoke. */
export function useShareManage() {
  const [reloadKey, setReloadKey] = useState(0);
  const list = useApiResource<ShareListResponse>('/api/share', reloadKey);

  const revoke = useCallback(async (token: string) => {
    await apiFetch<{ deleted: boolean }>(`/api/share/${encodeURIComponent(token)}`, {
      method: 'DELETE',
    });
    setReloadKey((k) => k + 1);
  }, []);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    items: list.data?.items ?? [],
    loading: list.loading,
    error: list.error,
    revoke,
    reload,
  };
}
