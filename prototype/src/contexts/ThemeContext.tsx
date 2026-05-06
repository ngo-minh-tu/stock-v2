'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api';
import {
  DEFAULT_THEME,
  STORAGE_KEYS,
  THEME_KEYS,
  type ThemeKey,
  themeKeyToBackend,
} from '@/lib/constants';

interface ThemeContextValue {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
  options: readonly ThemeKey[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeAttribute(theme: ThemeKey) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(DEFAULT_THEME);

  // After mount, hydrate from localStorage. Inline script in <head> already set
  // the data-theme attribute pre-render to avoid flash; this just syncs React state.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (stored && (THEME_KEYS as readonly string[]).includes(stored)) {
      setThemeState(stored as ThemeKey);
    }
  }, []);

  const setTheme = useCallback((next: ThemeKey) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEYS.theme, next);
    applyThemeAttribute(next);

    // Fire-and-forget sync to backend (cluster prompt §9.1)
    const { theme, classic_mode } = themeKeyToBackend(next);
    apiFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ theme, classic_mode }),
    }).catch(() => {
      /* ignore: prototype mock */
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, options: THEME_KEYS }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * Inline script source. Runs in <head> BEFORE React mounts so the theme attribute
 * is set on <html> before first paint — eliminates flash-of-default-theme.
 */
export const themeBootScript = `
(function(){
  try {
    var t = localStorage.getItem('${STORAGE_KEYS.theme}');
    var valid = ${JSON.stringify(THEME_KEYS)};
    if (!t || valid.indexOf(t) === -1) t = '${DEFAULT_THEME}';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', '${DEFAULT_THEME}');
  }
})();
`;
