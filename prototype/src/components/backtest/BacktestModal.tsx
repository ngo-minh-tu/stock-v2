'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { period_from: string; period_to: string }) => Promise<void>;
}

const TODAY = '2026-05-07';

function defaultPeriodFrom(): string {
  // 6 months prior to TODAY.
  const d = new Date(TODAY);
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
}

export function BacktestModal({ open, onClose, onSubmit }: Props) {
  const t = useTranslations('backtest.modal');

  const [periodFrom, setPeriodFrom] = useState(defaultPeriodFrom());
  const [periodTo, setPeriodTo] = useState(TODAY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (periodFrom >= periodTo) {
      setError(t('error.range'));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ period_from: periodFrom, period_to: periodTo });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('error.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

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
          <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
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
          <span className="text-sm font-medium">{t('periodFrom')}</span>
          <input
            type="date"
            max={periodTo}
            className="input-control"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('periodTo')}</span>
          <input
            type="date"
            max={TODAY}
            min={periodFrom}
            className="input-control"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </label>

        {error && (
          <span style={{ color: 'var(--ssi-down)' }} className="text-xs">
            {error}
          </span>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? t('submitting') : t('submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
