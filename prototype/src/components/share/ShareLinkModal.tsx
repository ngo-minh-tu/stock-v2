'use client';

// Cluster 6 §4.2 — modal that POSTs /api/share, shows the URL, copy-to-clipboard,
// regenerate, and a 7-day countdown derived from expires_at.

import { Copy, Loader2, RefreshCw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { useShareCreate } from '@/lib/hooks/useShareLink';

interface Props {
  open: boolean;
  runId: string | null;
  onClose: () => void;
}

function relativeExpiry(iso: string, nowMs: number = Date.now()): string {
  const diffMs = new Date(iso).getTime() - nowMs;
  if (diffMs <= 0) return 'đã hết hạn';
  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days} ngày ${hours}h`;
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hours}h ${minutes}p`;
}

export function ShareLinkModal({ open, runId, onClose }: Props) {
  const t = useTranslations('share');
  const tModal = useTranslations('share.modal');
  const { push } = useToast();
  const share = useShareCreate();

  // Auto-create on open. The `share` hook returns stable callbacks (useCallback w/ no
  // deps), so we intentionally only re-run when (open, runId) changes — including
  // `share` here would cause a re-create loop on every render.
  useEffect(() => {
    if (open && runId) {
      share.create(runId);
    }
    if (!open) {
      share.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!share.link) return;
    try {
      // Build a fully-qualified URL for the current origin so the recipient can open it
      // in the same browser (the mock URL points to a placeholder host).
      const localUrl = `${window.location.origin}/share/${share.link.token}`;
      await navigator.clipboard.writeText(localUrl);
      push({
        kind: 'success',
        title: t('copy.success'),
        message: localUrl,
      });
    } catch {
      push({ kind: 'error', title: t('copy.fail'), message: '' });
    }
  };

  const handleRegenerate = () => {
    if (runId) share.create(runId);
  };

  const localUrl = share.link
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${share.link.token}`
    : '';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-theme-overlay)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-md border p-6 flex flex-col gap-4"
        style={{
          backgroundColor: 'var(--color-theme-secondary)',
          borderColor: 'var(--color-theme-charcoal)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {tModal('title')}
            </h2>
            {runId && (
              <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
                Run: {runId}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 opacity-70 hover:opacity-100"
            aria-label={tModal('close')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {share.loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            {tModal('creating')}
          </div>
        )}

        {share.error && (
          <p className="text-xs" style={{ color: 'var(--ssi-down)' }}>
            {share.error}
          </p>
        )}

        {share.link && !share.loading && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-2xs">
              <span style={{ color: 'var(--color-theme-text-secondary)' }}>
                {t('url.label')}
              </span>
              <div className="flex items-stretch gap-2">
                <input
                  className="input-control flex-1 font-mono text-2xs"
                  value={localUrl}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCopy}
                  aria-label={t('copy.aria')}
                >
                  <Copy size={14} aria-hidden="true" />
                  {t('copy.button')}
                </button>
              </div>
            </label>

            <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {t('expires', { remaining: relativeExpiry(share.link.expires_at) })}
            </p>

            <p className="text-2xs px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-theme-tertiary)', color: 'var(--color-theme-text-secondary)' }}>
              {t('note.basicAuth')}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleRegenerate}
            disabled={share.loading || !runId}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t('regenerate')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {tModal('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
