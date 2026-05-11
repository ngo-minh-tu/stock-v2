'use client';

// Tiny "GET once" hook with refresh + manual reload key. Built on apiFetch.
// Avoids pulling in SWR for the few read-only endpoints we hit in cluster 2.

import { useEffect, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api';

interface State<T> {
  data: T | null;
  error: ApiError | Error | null;
  loading: boolean;
}

export function useApiResource<T>(path: string | null, reloadKey: number = 0): State<T> {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: false });

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    apiFetch<T>(path)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((e: ApiError | Error) => {
        if (!cancelled) setState({ data: null, error: e, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [path, reloadKey]);

  return state;
}
