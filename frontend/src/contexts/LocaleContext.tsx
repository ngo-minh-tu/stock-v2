'use client';

import { type AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';

import { apiFetch } from '@/lib/api';
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  STORAGE_KEYS,
  localeToBackend,
} from '@/lib/constants';

const MESSAGES: Record<Locale, AbstractIntlMessages> = {
  vi: viMessages as AbstractIntlMessages,
  en: enMessages as AbstractIntlMessages,
};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  options: readonly Locale[];
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.locale);
    if (stored && (LOCALES as readonly string[]).includes(stored)) {
      setLocaleState(stored as Locale);
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEYS.locale, next);

    apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ language: localeToBackend(next) }),
    }).catch(() => {
      /* ignore: prototype mock */
    });
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, options: LOCALES }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider
        locale={locale}
        messages={MESSAGES[locale]}
        // Fallback per AC-17-07: missing keys → render key (next-intl default).
        // VIE messages cover full surface so missing only happens during dev.
        onError={() => {
          /* swallow MISSING_MESSAGE in prototype */
        }}
        getMessageFallback={({ key }) => key}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
