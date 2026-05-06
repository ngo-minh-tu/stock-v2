// Mirror TAD/SRS enums (g03-appendix-enums-constants.md).
// Cluster 1 only uses Theme/Locale/RunStatus; the rest are pre-declared so later clusters can import.

export const THEME_KEYS = ['classic-dark', 'classic-light', 'light', 'oled'] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export const DEFAULT_THEME: ThemeKey = 'classic-dark';

export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'vi';

// SRS f15: theme = enum(CLASSIC | LIGHT | OLED), classic_mode = enum(DARK | LIGHT)
// Mapping between the 4-state UI key and the persisted backend shape.
export type BackendTheme = 'CLASSIC' | 'LIGHT' | 'OLED';
export type BackendClassicMode = 'DARK' | 'LIGHT';
export type BackendLanguage = 'VIE' | 'ENG';

export function themeKeyToBackend(key: ThemeKey): { theme: BackendTheme; classic_mode: BackendClassicMode } {
  switch (key) {
    case 'classic-dark':
      return { theme: 'CLASSIC', classic_mode: 'DARK' };
    case 'classic-light':
      return { theme: 'CLASSIC', classic_mode: 'LIGHT' };
    case 'light':
      return { theme: 'LIGHT', classic_mode: 'DARK' };
    case 'oled':
      return { theme: 'OLED', classic_mode: 'DARK' };
  }
}

export function backendToThemeKey(theme: BackendTheme, classic_mode: BackendClassicMode): ThemeKey {
  if (theme === 'CLASSIC') return classic_mode === 'LIGHT' ? 'classic-light' : 'classic-dark';
  if (theme === 'LIGHT') return 'light';
  return 'oled';
}

export function localeToBackend(locale: Locale): BackendLanguage {
  return locale === 'vi' ? 'VIE' : 'ENG';
}

export function backendToLocale(lang: BackendLanguage): Locale {
  return lang === 'VIE' ? 'vi' : 'en';
}

// TAD g02 RunStatus (used by later clusters)
export const RUN_STATUS = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'PARTIAL'] as const;
export type RunStatus = (typeof RUN_STATUS)[number];

// LocalStorage keys
export const STORAGE_KEYS = {
  token: 'token',
  theme: 'theme',
  locale: 'locale',
} as const;

// Mock JWT prefix (c08 §2 + cluster prompt §7)
export const MOCK_JWT_PREFIX = 'mock-jwt-';
