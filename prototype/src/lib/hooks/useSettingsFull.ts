'use client';

// Cluster 6 §6 — single hook for the full Settings page. Fetches once on mount,
// exposes a `save(patch)` mutator that PUT-s a partial update + bumps a reload key
// so the page reflects the post-save state (settings_version, updated_at).

import { useCallback, useState } from 'react';

import { ApiError, apiFetch } from '@/lib/api';
import { useApiResource } from '@/lib/hooks/useApiResource';
import type { SettingsData } from '@/lib/types';

interface SaveState {
  saving: boolean;
  error: string | null;
}

export function useSettingsFull() {
  const [reloadKey, setReloadKey] = useState(0);
  const res = useApiResource<SettingsData>('/api/settings', reloadKey);
  const [saveState, setSaveState] = useState<SaveState>({ saving: false, error: null });

  const save = useCallback(
    async (patch: Partial<SettingsData>): Promise<SettingsData | null> => {
      setSaveState({ saving: true, error: null });
      try {
        const data = await apiFetch<SettingsData>('/api/settings', {
          method: 'PUT',
          body: JSON.stringify(patch),
        });
        setSaveState({ saving: false, error: null });
        // Bump reload key so any other consumer of useApiResource('/api/settings') refreshes.
        setReloadKey((k) => k + 1);
        return data;
      } catch (e) {
        const message = e instanceof ApiError ? e.message : 'Lỗi máy chủ.';
        setSaveState({ saving: false, error: message });
        return null;
      }
    },
    [],
  );

  return {
    data: res.data,
    loading: res.loading,
    error: res.error,
    saving: saveState.saving,
    saveError: saveState.error,
    save,
  };
}
