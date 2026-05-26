'use client';

// Cluster 6 §3 — fetch the PDF blob, trigger a browser download via temporary anchor.
//
// Phase 27 refactor (Phase 19 REVIEW Low carry):
//   Trước: `await blob.text()` decode UTF-16 → reconstruct Blob → corrupt non-UTF8
//   bytes nếu BE serve WeasyPrint binary PDF (real `%PDF-1.7` header).
//   Sau: giữ NGUYÊN raw Blob từ fetch; preview HTML chỉ decode khi BE trả html_mock
//   mode (detected qua magic bytes). `confirmDownload` dùng raw blob cached.

import { useCallback, useState } from 'react';

import { ApiError, resolveUrl } from '@/lib/api';
import { STORAGE_KEYS } from '@/lib/constants';

interface State {
  loading: boolean;
  error: string | null;
  /** Decoded HTML cho preview iframe — null khi BE serve binary PDF (WeasyPrint mode). */
  previewHtml: string | null;
  /** Object URL cho binary PDF preview iframe — null in html_mock mode. */
  previewUrl: string | null;
  /** Cached raw blob từ fetch; reused bởi `confirmDownload` — KHÔNG reconstruct. */
  previewBlob: Blob | null;
  /** Last fetched run id, so the modal can show "Run X" without prop-drilling. */
  previewRunId: string | null;
}

const PDF_MAGIC = '%PDF';

async function inspectBlobType(blob: Blob): Promise<{ isBinaryPdf: boolean }> {
  const head = await blob.slice(0, 4).arrayBuffer();
  const magic = new TextDecoder('ascii').decode(head);
  return { isBinaryPdf: magic === PDF_MAGIC };
}

async function fetchPdf(runId: string): Promise<{ blob: Blob; previewHtml: string | null }> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.token) : null;
  const url = resolveUrl(`/api/export/pdf/${encodeURIComponent(runId)}?_=${Date.now()}`);
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: 'no-store',
  });
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
  const { isBinaryPdf } = await inspectBlobType(blob);
  // html_mock mode → decode để render iframe preview. WeasyPrint binary → previewHtml=null
  // (iframe sẽ hiển thị fallback message, nút Download vẫn dùng blob gốc).
  const previewHtml = isBinaryPdf ? null : await blob.text();
  return { blob, previewHtml };
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
    previewUrl: null,
    previewBlob: null,
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
    setState((s) => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return {
        loading: true,
        error: null,
        previewHtml: null,
        previewUrl: null,
        previewBlob: null,
        previewRunId: runId,
      };
    });
    try {
      const { blob, previewHtml } = await fetchPdf(runId);
      const previewUrl = previewHtml ? null : URL.createObjectURL(blob);
      setState({
        loading: false,
        error: null,
        previewHtml,
        previewUrl,
        previewBlob: blob,
        previewRunId: runId,
      });
      return true;
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Không thể xuất PDF.';
      setState({
        loading: false,
        error: message,
        previewHtml: null,
        previewUrl: null,
        previewBlob: null,
        previewRunId: runId,
      });
      return false;
    }
  }, []);

  /** Use the cached raw blob to trigger the actual download. */
  const confirmDownload = useCallback(() => {
    setState((s) => {
      if (!s.previewBlob || !s.previewRunId) return s;
      triggerDownload(s.previewBlob, `run-${s.previewRunId}.pdf`);
      return s;
    });
  }, []);

  const closePreview = useCallback(() => {
    setState((s) => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return {
        loading: false,
        error: null,
        previewHtml: null,
        previewUrl: null,
        previewBlob: null,
        previewRunId: null,
      };
    });
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    previewHtml: state.previewHtml,
    previewUrl: state.previewUrl,
    canDownload: Boolean(state.previewBlob),
    previewRunId: state.previewRunId,
    downloadDirect,
    loadPreview,
    confirmDownload,
    closePreview,
  };
}
