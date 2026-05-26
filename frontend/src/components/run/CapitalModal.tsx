'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (totalCapital: number) => void;
}

export function CapitalModal({ open, onClose, onSubmit }: Props) {
  const t = useTranslations('run.modal.capital');
  const [raw, setRaw] = useState('500000000');
  const [skipAlloc, setSkipAlloc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
    }
  }, [open]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (skipAlloc) {
      onSubmit(0);
      return;
    }
    const value = Number(raw.replace(/[^0-9]/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('errorInvalid'));
      return;
    }
    onSubmit(value);
  };

  // VND formatter (fr-FR uses spaces — Vietnamese-friendly).
  const formatted = (() => {
    const n = Number(raw.replace(/[^0-9]/g, ''));
    return Number.isFinite(n) ? n.toLocaleString('fr-FR') : '';
  })();

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-theme-overlay)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-md border p-6 flex flex-col gap-4"
        style={{
          backgroundColor: 'var(--color-theme-secondary)',
          borderColor: 'var(--color-theme-charcoal)',
        }}
      >
        <div className="flex items-start justify-between">
          <h2
            className="text-md font-medium"
            style={{ color: 'var(--color-theme-text-tertiary)' }}
          >
            {t('title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 opacity-70 hover:opacity-100"
            aria-label={t('close')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p className="text-xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('description')}
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('label')}</span>
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              inputMode="numeric"
              className="input-control flex-1"
              placeholder={t('placeholder')}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setError(null);
              }}
              disabled={skipAlloc}
              autoFocus
            />
            <span
              className="flex items-center px-3 rounded text-xs"
              style={{
                backgroundColor: 'var(--color-theme-tertiary)',
                color: 'var(--color-theme-text-secondary)',
              }}
            >
              VND
            </span>
          </div>
          {!skipAlloc && formatted && (
            <span className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
              ≈ {formatted} VND
            </span>
          )}
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={skipAlloc}
            onChange={(e) => setSkipAlloc(e.target.checked)}
            className="accent-current"
          />
          <span>{t('skipAllocation')}</span>
        </label>

        {error && <span style={{ color: 'var(--ssi-down)' }} className="text-xs">{error}</span>}

        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {t('submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
