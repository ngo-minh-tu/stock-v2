'use client';

// Cluster 6 §5.1 — Telegram settings card.
// Toggle Bật/Tắt + (when enabled) bot token (password input + show/hide), chat_id, top N (3 or 5),
// and a Test send button. "Save" is explicit — debounced auto-save would risk hitting the
// validation `enabled+empty` error mid-typing.

import { Eye, EyeOff, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { TelegramTestButton } from '@/components/telegram/TelegramTestButton';
import { useToast } from '@/contexts/ToastContext';
import type { SettingsData } from '@/lib/types';

interface Props {
  data: SettingsData;
  saving: boolean;
  onSave: (patch: Partial<SettingsData>) => Promise<SettingsData | null>;
}

export function TelegramSettings({ data, saving, onSave }: Props) {
  const t = useTranslations('telegram');
  const { push } = useToast();

  const [enabled, setEnabled] = useState(data.telegram_enabled);
  const [chatId, setChatId] = useState(data.telegram_chat_id);
  const [token, setToken] = useState(data.telegram_token);
  const [topN, setTopN] = useState<3 | 5>(data.telegram_top_n);
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync form state if the upstream data changes (e.g., after a save).
  useEffect(() => {
    setEnabled(data.telegram_enabled);
    setChatId(data.telegram_chat_id);
    setToken(data.telegram_token);
    setTopN(data.telegram_top_n);
  }, [data]);

  const dirty =
    enabled !== data.telegram_enabled ||
    chatId !== data.telegram_chat_id ||
    token !== data.telegram_token ||
    topN !== data.telegram_top_n;

  const handleSave = async () => {
    setError(null);
    if (enabled && !chatId.trim()) {
      setError(t('error.chatIdRequired'));
      return;
    }
    if (enabled && !token.trim()) {
      setError(t('error.tokenRequired'));
      return;
    }
    const ok = await onSave({
      telegram_enabled: enabled,
      telegram_chat_id: chatId,
      telegram_token: token,
      telegram_top_n: topN,
    });
    if (ok) {
      push({ kind: 'success', title: t('save.success'), message: '' });
    } else {
      setError(t('save.error'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('toggle')}
          </div>
          <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('info.runComplete')}
          </p>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 cursor-pointer"
        />
      </label>

      {enabled && (
        <div className="flex flex-col gap-3 pl-1">
          <label className="flex flex-col gap-1 text-2xs">
            <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('botToken')}</span>
            <div className="flex items-stretch gap-2">
              <input
                type={showToken ? 'text' : 'password'}
                className="input-control flex-1 font-mono text-2xs"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456:ABC-DEF…"
                autoComplete="off"
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowToken((s) => !s)}
                aria-label={showToken ? t('hideToken') : t('showToken')}
              >
                {showToken ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1 text-2xs max-w-md">
            <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('chatId')}</span>
            <input
              type="text"
              className="input-control"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890"
              autoComplete="off"
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-2xs">
            <legend style={{ color: 'var(--color-theme-text-secondary)' }}>{t('topN.label')}</legend>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="telegram-top-n"
                  checked={topN === 3}
                  onChange={() => setTopN(3)}
                />
                {t('topN.3')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="telegram-top-n"
                  checked={topN === 5}
                  onChange={() => setTopN(5)}
                />
                {t('topN.5')}
              </label>
            </div>
          </fieldset>

          <p className="text-2xs px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-theme-tertiary)', color: 'var(--color-theme-text-secondary)' }}>
            {t('info.format')}
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: 'var(--ssi-down)' }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          {saving ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <Save size={14} aria-hidden="true" />
          )}
          {t('save.button')}
        </button>
        <TelegramTestButton disabled={!enabled || !chatId.trim() || !token.trim()} />
      </div>
    </div>
  );
}
