'use client';

// Cluster 6 §5.2 — POST /api/telegram/test (mock 70% success / 30% error).
// Disabled when chat_id or token is empty.

import { Loader2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { ApiError, apiFetch } from '@/lib/api';
import type { TelegramTestResponse } from '@/lib/types';

interface Props {
  disabled?: boolean;
}

export function TelegramTestButton({ disabled }: Props) {
  const t = useTranslations('telegram');
  const { push } = useToast();
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<TelegramTestResponse>('/api/telegram/test', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (data.sent) {
        push({ kind: 'success', title: t('test.success'), message: '' });
      } else {
        push({ kind: 'error', title: t('test.error'), message: data.error ?? '' });
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.message : '';
      push({ kind: 'error', title: t('test.error'), message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={handleTest}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 size={14} aria-hidden="true" className="animate-spin" />
      ) : (
        <Send size={14} aria-hidden="true" />
      )}
      {t('testButton')}
    </button>
  );
}
