'use client';

// Cluster 6 §6.3 — 5 news source toggles. Auto-save on change (no debounce — toggles
// are discrete clicks, not a continuous control). Toast confirmation.

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { NEWS_SOURCES, type NewsSourceKey } from '@/lib/constants';
import type { SettingsData } from '@/lib/types';

interface Props {
  data: SettingsData;
  saving: boolean;
  onSave: (patch: Partial<SettingsData>) => Promise<SettingsData | null>;
}

const SOURCE_TO_FIELD: Record<NewsSourceKey, keyof SettingsData> = {
  CAFEF: 'source_cafef',
  VNEXPRESS: 'source_vnexpress',
  VIETSTOCK: 'source_vietstock',
  BATDONGSAN: 'source_batdongsan',
  THANHNIEN: 'source_thanhnien',
};

export function NewsSourcesToggles({ data, saving, onSave }: Props) {
  const t = useTranslations('settings.sources');
  const tSource = useTranslations('news.source');
  const { push } = useToast();
  const [busy, setBusy] = useState<NewsSourceKey | null>(null);

  const handleToggle = async (source: NewsSourceKey) => {
    const field = SOURCE_TO_FIELD[source];
    const current = data[field] as boolean;
    setBusy(source);
    const ok = await onSave({ [field]: !current } as Partial<SettingsData>);
    setBusy(null);
    if (ok) {
      push({
        kind: 'success',
        title: t('save.success'),
        message: tSource(source),
      });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {NEWS_SOURCES.map((source) => {
        const field = SOURCE_TO_FIELD[source];
        const checked = data[field] as boolean;
        const isBusy = busy === source || saving;
        return (
          <label
            key={source}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded cursor-pointer"
            style={{ backgroundColor: 'var(--color-theme-tertiary)' }}
          >
            <span className="text-xs" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {tSource(source)}
            </span>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => handleToggle(source)}
              disabled={isBusy}
              className="w-4 h-4 cursor-pointer"
            />
          </label>
        );
      })}
    </div>
  );
}
