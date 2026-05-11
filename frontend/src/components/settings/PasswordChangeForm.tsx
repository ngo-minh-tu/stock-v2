'use client';

// Cluster 6 §6.4 — Password change form.
// Validates: current required, new ≥ 8 chars, confirm matches new.
// On success, the mock /api/auth/password returns a fresh JWT — we update localStorage
// to mimic re-login (matches AC-13-04 flow without booting the user out of the prototype).

import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { ApiError, apiFetch } from '@/lib/api';
import { STORAGE_KEYS } from '@/lib/constants';
import type { PasswordChangeResponse } from '@/lib/types';

export function PasswordChangeForm() {
  const t = useTranslations('settings.password');
  const { push } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!current) {
      setError(t('error.currentRequired'));
      return;
    }
    if (next.length < 8) {
      setError(t('error.tooShort'));
      return;
    }
    if (next !== confirm) {
      setError(t('error.mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiFetch<PasswordChangeResponse>('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ current, new_password: next }),
      });
      // Mimic re-login: persist the fresh token so subsequent requests stay authenticated.
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.token, data.token);
      }
      push({ kind: 'success', title: t('success'), message: t('reLoginNote') });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
      <label className="flex flex-col gap-1 text-2xs">
        <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('current')}</span>
        <input
          type="password"
          className="input-control"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      <label className="flex flex-col gap-1 text-2xs">
        <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('new')}</span>
        <input
          type="password"
          className="input-control"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
        <span className="text-3xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('hint')}
        </span>
      </label>

      <label className="flex flex-col gap-1 text-2xs">
        <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('confirm')}</span>
        <input
          type="password"
          className="input-control"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </label>

      {error && (
        <p className="text-xs" style={{ color: 'var(--ssi-down)' }}>
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary self-start" disabled={submitting}>
        {submitting ? (
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
        ) : (
          <Save size={14} aria-hidden="true" />
        )}
        {t('submit')}
      </button>
    </form>
  );
}
