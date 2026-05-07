'use client';

// Cluster 6 §4.4 + §6.6 — list of active share links + revoke action.
// Confirm dialog inline (same pattern as DeleteRunModal) to avoid an accidental revoke.

import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { useShareManage } from '@/lib/hooks/useShareLink';
import type { ShareLink } from '@/lib/types';

function relativeExpiry(iso: string, nowMs: number = Date.now()): string {
  const diffMs = new Date(iso).getTime() - nowMs;
  if (diffMs <= 0) return 'đã hết hạn';
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 1) {
    const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
    return `${days}d ${hours}h`;
  }
  const hours = Math.floor(diffMs / 3_600_000);
  return `${hours}h`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateToken(token: string): string {
  if (token.length <= 14) return token;
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

export function ShareLinksManagement() {
  const t = useTranslations('settings.share');
  const { push } = useToast();
  const { items, loading, revoke } = useShareManage();
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevoke = async (link: ShareLink) => {
    if (!window.confirm(t('management.revoke.confirm', { token: truncateToken(link.token) }))) return;
    setRevoking(link.token);
    try {
      await revoke(link.token);
      push({ kind: 'success', title: t('management.revoke.success'), message: '' });
    } catch {
      push({ kind: 'error', title: t('management.revoke.error'), message: '' });
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
        <Loader2 size={12} aria-hidden="true" className="animate-spin" />
        {t('management.loading')}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {t('management.empty')}
      </p>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-2xs">
        <thead style={{ backgroundColor: 'var(--color-theme-table-header)' }}>
          <tr>
            <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {t('management.column.token')}
            </th>
            <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {t('management.column.runId')}
            </th>
            <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {t('management.column.createdAt')}
            </th>
            <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {t('management.column.expiresAt')}
            </th>
            <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
              {t('management.column.action')}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((link, i) => (
            <tr
              key={link.token}
              style={{
                borderBottom: '1px solid var(--color-theme-table-border)',
                backgroundColor:
                  i % 2 === 0
                    ? 'var(--color-theme-table-row-even)'
                    : 'var(--color-theme-table-row-odd)',
              }}
            >
              <td className="px-3 py-2 font-mono">{truncateToken(link.token)}</td>
              <td className="px-3 py-2 font-mono">{link.run_id}</td>
              <td className="px-3 py-2">{fmtDate(link.created_at)}</td>
              <td className="px-3 py-2">
                <span title={fmtDate(link.expires_at)}>{relativeExpiry(link.expires_at)}</span>
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  className="p-1 opacity-70 hover:opacity-100"
                  onClick={() => handleRevoke(link)}
                  disabled={revoking === link.token}
                  aria-label={t('management.revoke.button')}
                  title={t('management.revoke.button')}
                  style={{ color: 'var(--ssi-down)' }}
                >
                  {revoking === link.token ? (
                    <Loader2 size={14} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Trash2 size={14} aria-hidden="true" />
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
