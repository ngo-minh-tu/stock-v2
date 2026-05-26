'use client';

// Cluster 6 §3.3 — PDF preview modal. Renders the same HTML returned by /export/pdf
// inside a sandboxed iframe (read-only) and offers a Download button.

import { Download, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  html: string | null;
  pdfUrl: string | null;
  canDownload: boolean;
  loading: boolean;
  error: string | null;
  runId: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function PdfPreviewModal({
  open,
  html,
  pdfUrl,
  canDownload,
  loading,
  error,
  runId,
  onConfirm,
  onClose,
}: Props) {
  const t = useTranslations('export.preview');
  const tCommon = useTranslations('export');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

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
        className="w-full max-w-4xl rounded-md border flex flex-col"
        style={{
          backgroundColor: 'var(--color-theme-secondary)',
          borderColor: 'var(--color-theme-charcoal)',
          maxHeight: '90vh',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-theme-charcoal)' }}>
          <div>
            <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {t('title')}
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
            aria-label={tCommon('close')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-[320px] overflow-hidden bg-white" style={{ minHeight: '60vh' }}>
          {loading && (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: '#1e2329' }}>
              <Loader2 size={16} aria-hidden="true" className="animate-spin mr-2" />
              {tCommon('loading')}
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ssi-down)' }}>
              {error}
            </div>
          )}
          {!loading && !error && pdfUrl && (
            <iframe
              title="PDF preview"
              src={pdfUrl}
              className="w-full h-full"
              style={{ border: 0, minHeight: '60vh' }}
            />
          )}
          {!loading && !error && !pdfUrl && html && (
            <iframe
              title="PDF preview"
              srcDoc={html}
              sandbox=""
              className="w-full h-full"
              style={{ border: 0, minHeight: '60vh' }}
            />
          )}
          {!loading && !error && !pdfUrl && !html && canDownload && (
            <div className="h-full flex items-center justify-center text-sm px-6 text-center" style={{ color: '#1e2329' }}>
              {t('binaryReady')}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--color-theme-charcoal)' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tCommon('close')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading || !canDownload}
          >
            <Download size={14} aria-hidden="true" />
            {t('download')}
          </button>
        </div>
      </div>
    </div>
  );
}
