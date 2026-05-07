'use client';

// Cluster 6 §3 — fetch the PDF blob, trigger a browser download via temporary anchor.
// Also exposes `previewHtml` for PdfPreviewModal so we can render the same body inline.

import { useCallback, useState } from 'react';

import { ApiError } from '@/lib/api';

interface State {
  loading: boolean;
  error: string | null;
  previewHtml: string | null;
  /** Last fetched run id, so the modal can show "Run X" without prop-drilling. */
  previewRunId: string | null;
}

async function fetchPdf(runId: string): Promise<{ blob: Blob; html: string }> {
  const res = await fetch(`/api/export/pdf/${encodeURIComponent(runId)}`);
  if (!res.ok) {
    // The handler returns JSON envelope on 4xx/5xx — try to extract it.
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      /* response wasn't JSON; keep status text */
    }
    throw new ApiError('EXPORT_FAILED', detail, res.status);
  }
  const blob = await res.blob();
  // We also keep the HTML (decoded from blob) so the preview iframe can show it.
  const html = await blob.text();
  // Re-create blob with same MIME to be safe (text() consumes — original was already cloned by fetch).
  const downloadBlob = new Blob([html], { type: 'application/pdf' });
  return { blob: downloadBlob, html };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke after the click completes — small delay so Safari gets a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useExportPdf() {
  const [state, setState] = useState<State>({
    loading: false,
    error: null,
    previewHtml: null,
    previewRunId: null,
  });

  /** Fetch + trigger download in one shot (for the inline button). */
  const downloadDirect = useCallback(async (runId: string): Promise<boolean> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { blob } = await fetchPdf(runId);
      triggerDownload(blob, `run-${runId}.pdf`);
      setState((s) => ({ ...s, loading: false }));
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Không thể xuất PDF.';
      setState((s) => ({ ...s, loading: false, error: message }));
      return false;
    }
  }, []);

  /** Fetch only — caller renders the preview iframe and triggers download via `confirmDownload`. */
  const loadPreview = useCallback(async (runId: string): Promise<boolean> => {
    setState({ loading: true, error: null, previewHtml: null, previewRunId: runId });
    try {
      const { html } = await fetchPdf(runId);
      setState({ loading: false, error: null, previewHtml: html, previewRunId: runId });
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Không thể xuất PDF.';
      setState({ loading: false, error: message, previewHtml: null, previewRunId: runId });
      return false;
    }
  }, []);

  /** Use the cached preview HTML to trigger the actual download. */
  const confirmDownload = useCallback(() => {
    setState((s) => {
      if (!s.previewHtml || !s.previewRunId) return s;
      const blob = new Blob([s.previewHtml], { type: 'application/pdf' });
      triggerDownload(blob, `run-${s.previewRunId}.pdf`);
      return s;
    });
  }, []);

  const closePreview = useCallback(() => {
    setState({ loading: false, error: null, previewHtml: null, previewRunId: null });
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    previewHtml: state.previewHtml,
    previewRunId: state.previewRunId,
    downloadDirect,
    loadPreview,
    confirmDownload,
    closePreview,
  };
}
