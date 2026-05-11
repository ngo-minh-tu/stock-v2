'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { ApiError } from '@/lib/api';

interface Props {
  open: boolean;
  ticker: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteHoldingModal({ open, ticker, onClose, onConfirm }: Props) {
  const t = useTranslations('portfolio.delete');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setError(null);
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

  if (!open || !ticker) return null;

  const handle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('serverError'));
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
      <div
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

        <p className="text-sm">{t('confirm', { ticker })}</p>

        {error && (
          <span style={{ color: 'var(--ssi-down)' }} className="text-xs">
            {error}
          </span>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn"
            style={{ backgroundColor: 'var(--ssi-down)', color: '#ffffff' }}
            onClick={handle}
            disabled={submitting}
          >
            {submitting ? t('deleting') : t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
