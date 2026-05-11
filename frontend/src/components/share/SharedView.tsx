'use client';

// Cluster 6 §4.3 — public read-only view rendered at /share/[token].
// No header/sidebar (no AppShell). No Run selector. Watermark across the page.
// Token validation + run fetch happens via /api/share/{token}.

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { Disclaimer } from '@/components/layout/Disclaimer';
import { TopMuaTable } from '@/components/tables/TopMuaTable';
import { ApiError, apiFetch } from '@/lib/api';
import type { SharedViewResponse } from '@/lib/types';

interface Props {
  token: string;
}

interface State {
  data: SharedViewResponse | null;
  error: { code: string; message: string } | null;
  loading: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeExpiry(iso: string, nowMs: number = Date.now()): string {
  const diffMs = new Date(iso).getTime() - nowMs;
  if (diffMs <= 0) return 'đã hết hạn';
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 1) {
    const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
    return `còn ${days} ngày ${hours}h`;
  }
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return `còn ${hours}h ${minutes}p`;
}

export function SharedView({ token }: Props) {
  const t = useTranslations('share.view');
  const [state, setState] = useState<State>({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    apiFetch<SharedViewResponse>(`/api/share/${encodeURIComponent(token)}`)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const apiErr = e as ApiError;
        const code = apiErr?.code ?? 'NOT_FOUND';
        const message =
          apiErr?.message ?? 'Link không tồn tại hoặc đã hết hạn.';
        setState({ data: null, error: { code, message }, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-theme-primary)' }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          {t('loading')}
        </div>
      </main>
    );
  }

  if (state.error || !state.data) {
    const isExpired = state.error?.code === 'EXPIRED';
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: 'var(--color-theme-primary)' }}
      >
        <div className="card p-8 max-w-md text-center flex flex-col gap-3">
          <h1 className="text-2xl font-medium" style={{ color: 'var(--ssi-down)' }}>
            {isExpired ? t('expired.title') : t('invalid.title')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {isExpired ? t('expired.body') : t('invalid.body')}
          </p>
          <p className="text-2xs font-mono" style={{ color: 'var(--color-theme-text-secondary)' }}>
            Token: {token}
          </p>
        </div>
      </main>
    );
  }

  const { data } = state;

  return (
    <div
      className="min-h-screen relative"
      style={{ backgroundColor: 'var(--color-theme-primary)', color: 'var(--color-theme-text-tertiary)' }}
    >
      {/* Watermark — pointer-events:none so it doesn't block interactions. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none flex items-center justify-center"
        style={{ zIndex: 0 }}
      >
        <span
          className="font-bold uppercase select-none"
          style={{
            fontSize: 'min(14vw, 160px)',
            color: 'var(--color-theme-text-tertiary)',
            opacity: 0.04,
            transform: 'rotate(-30deg)',
            letterSpacing: '0.1em',
          }}
        >
          {t('watermark')}
        </span>
      </div>

      <div className="relative" style={{ zIndex: 1 }}>
        <header
          className="border-b px-6 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--color-theme-secondary)',
            borderColor: 'var(--color-theme-charcoal)',
          }}
        >
          <div>
            <h1 className="text-md font-medium" style={{ color: 'var(--color-theme-crimson)' }}>
              {t('header')}
            </h1>
            <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
              Run: {data.run_id}
            </p>
          </div>
          <div
            className="text-2xs px-2.5 py-1 rounded"
            style={{
              border: '1px solid var(--ssi-stable)',
              color: 'var(--ssi-stable)',
            }}
            title={`Hết hạn: ${formatDate(data.expires_at)}`}
          >
            {t('expiresIn', { remaining: relativeExpiry(data.expires_at) })}
          </div>
        </header>

        <main className="px-6 py-6 flex flex-col gap-6 max-w-7xl mx-auto">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {t('section.dashboard')}
            </h2>
            <DashboardGrid data={data.data.dashboard} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {t('section.topMua')}
            </h2>
            <TopMuaTable
              results={data.data.top_mua}
              runId={data.run_id}
              readOnly
            />
          </section>

          <Disclaimer />
        </main>
      </div>
    </div>
  );
}
