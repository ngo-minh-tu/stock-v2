'use client';

// Cluster 6 §3.1 — Export PDF button. Used on Dashboard, Top MUA (full label) and as a
// row-level icon on the Run History table. The "preview" prop opens a PdfPreviewModal
// before triggering the download.

import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { useExportPdf } from '@/lib/hooks/useExportPdf';

import { PdfPreviewModal } from './PdfPreviewModal';

interface Props {
  runId: string | null;
  /** "label" = full text button, "icon" = compact icon-only (Run History row). */
  variant?: 'label' | 'icon';
  /** Override label text — Top MUA uses "Xuất PDF Top MUA". */
  label?: string;
  /** Open a preview modal before downloading. Defaults to true. */
  preview?: boolean;
  /** Disable when no run is available yet. */
  disabled?: boolean;
}

export function ExportPdfButton({
  runId,
  variant = 'label',
  label,
  preview = true,
  disabled,
}: Props) {
  const t = useTranslations('export');
  const { push } = useToast();
  const exportPdf = useExportPdf();
  const [open, setOpen] = useState(false);

  const handleClick = async () => {
    if (!runId) return;
    if (preview) {
      setOpen(true);
      const ok = await exportPdf.loadPreview(runId);
      if (!ok) {
        push({ kind: 'error', title: t('error.title'), message: exportPdf.error ?? '' });
        setOpen(false);
      }
    } else {
      const ok = await exportPdf.downloadDirect(runId);
      if (ok) {
        push({ kind: 'success', title: t('success'), message: `run-${runId}.pdf` });
      } else {
        push({ kind: 'error', title: t('error.title'), message: exportPdf.error ?? '' });
      }
    }
  };

  const handleConfirmDownload = () => {
    exportPdf.confirmDownload();
    if (runId) {
      push({ kind: 'success', title: t('success'), message: `run-${runId}.pdf` });
    }
    setOpen(false);
    exportPdf.closePreview();
  };

  const handleClose = () => {
    setOpen(false);
    exportPdf.closePreview();
  };

  const isDisabled = disabled || !runId || exportPdf.loading;

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          className="p-1 opacity-70 hover:opacity-100 disabled:opacity-30"
          onClick={handleClick}
          disabled={isDisabled}
          aria-label={label ?? t('button')}
          title={label ?? t('button')}
        >
          {exportPdf.loading ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <Download size={14} aria-hidden="true" />
          )}
        </button>
        {preview && (
          <PdfPreviewModal
            open={open}
            html={exportPdf.previewHtml}
            pdfUrl={exportPdf.previewUrl}
            canDownload={exportPdf.canDownload}
            loading={exportPdf.loading}
            error={exportPdf.error}
            runId={exportPdf.previewRunId}
            onConfirm={handleConfirmDownload}
            onClose={handleClose}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={handleClick}
        disabled={isDisabled}
      >
        {exportPdf.loading ? (
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
        ) : (
          <Download size={14} aria-hidden="true" />
        )}
        {exportPdf.loading ? t('loading') : label ?? t('button')}
      </button>
      {preview && (
        <PdfPreviewModal
          open={open}
          html={exportPdf.previewHtml}
          pdfUrl={exportPdf.previewUrl}
          canDownload={exportPdf.canDownload}
          loading={exportPdf.loading}
          error={exportPdf.error}
          runId={exportPdf.previewRunId}
          onConfirm={handleConfirmDownload}
          onClose={handleClose}
        />
      )}
    </>
  );
}
