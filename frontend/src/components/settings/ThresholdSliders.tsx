'use client';

// Cluster 6 §6.2 — Thresholds card.
// Auto-save with 500ms debounce. Validation: buy_threshold > hold_min_threshold.
// Errors block save and show inline; preview line updates live.

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import type { SettingsData } from '@/lib/types';

interface Props {
  data: SettingsData;
  saving: boolean;
  onSave: (patch: Partial<SettingsData>) => Promise<SettingsData | null>;
}

export function ThresholdSliders({ data, saving, onSave }: Props) {
  const t = useTranslations('settings.threshold');
  const { push } = useToast();
  const [buy, setBuy] = useState(data.buy_threshold);
  const [hold, setHold] = useState(data.hold_min_threshold);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef({ buy: data.buy_threshold, hold: data.hold_min_threshold });

  // Sync from upstream (e.g. another save bumped settings_version).
  useEffect(() => {
    setBuy(data.buy_threshold);
    setHold(data.hold_min_threshold);
    lastSavedRef.current = { buy: data.buy_threshold, hold: data.hold_min_threshold };
  }, [data.buy_threshold, data.hold_min_threshold]);

  // Debounced auto-save.
  useEffect(() => {
    const e = buy <= hold ? t('error.invalid') : null;
    setError(e);
    if (e) return;
    if (buy === lastSavedRef.current.buy && hold === lastSavedRef.current.hold) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const ok = await onSave({ buy_threshold: buy, hold_min_threshold: hold });
      if (ok) {
        lastSavedRef.current = { buy, hold };
        push({ kind: 'success', title: t('save.success'), message: '' });
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [buy, hold, onSave, push, t]);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-2xs flex items-center justify-between">
          <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('buy')}</span>
          <strong className="tabular-nums" style={{ color: 'var(--ssi-up)' }}>≥ {buy}</strong>
        </span>
        <input
          type="range"
          min={50}
          max={95}
          value={buy}
          onChange={(e) => setBuy(Number(e.target.value))}
          className="w-full accent-green-500"
          aria-label={t('buy')}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-2xs flex items-center justify-between">
          <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('hold')}</span>
          <strong className="tabular-nums" style={{ color: 'var(--ssi-stable)' }}>≥ {hold}</strong>
        </span>
        <input
          type="range"
          min={20}
          max={70}
          value={hold}
          onChange={(e) => setHold(Number(e.target.value))}
          className="w-full accent-yellow-500"
          aria-label={t('hold')}
        />
      </label>

      <div className="text-2xs px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-theme-tertiary)' }}>
        {t('preview', { buy, holdLow: hold, holdHigh: buy - 1 })}
      </div>

      {error && (
        <p className="text-xs" style={{ color: 'var(--ssi-down)' }}>
          {error}
        </p>
      )}

      {saving && !error && (
        <span className="text-2xs flex items-center gap-1" style={{ color: 'var(--color-theme-text-secondary)' }}>
          <Loader2 size={12} aria-hidden="true" className="animate-spin" />
          {t('saving')}
        </span>
      )}
    </div>
  );
}
