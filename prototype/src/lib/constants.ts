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

// TAD g01-runtime §2.1 — canonical 7-state RunStatus enum (shared by SRS + TAD).
export const RUN_STATUS = [
  'PENDING',
  'CHECKING_DATA',
  'SCREENING',
  'SCORING',
  'COMPLETED',
  'COMPLETED_WITH_WARNINGS',
  'FAILED',
] as const;
export type RunStatus = (typeof RUN_STATUS)[number];

export const RUN_TERMINAL_STATES: ReadonlySet<RunStatus> = new Set([
  'COMPLETED',
  'COMPLETED_WITH_WARNINGS',
  'FAILED',
]);

// SRS g03 — Recommendation enum (VIE labels are canonical, ENG mirror in messages).
export const RECOMMENDATIONS = ['MUA', 'GIU', 'BAN'] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

// SRS f03 / TAD c03 — Entry signal enum.
export const ENTRY_SIGNALS = [
  'BUY_STRONG',
  'BUY_NOW',
  'WAIT_FOR_BREAKOUT',
  'WAIT_FOR_PULLBACK',
  'WAIT_FOR_CONFIRMATION',
  'NO_ENTRY',
  'INSUFFICIENT_DATA',
] as const;
export type EntrySignal = (typeof ENTRY_SIGNALS)[number];

// Per-signal display meta (cluster 3 §6 — colors keyed to design.md §3.2 stock semantics).
// `tone`: drives chip / large badge color. `priority`: SRS-03 priority order (lower = checked first).
export const ENTRY_SIGNAL_META: Record<
  EntrySignal,
  { tone: 'green-strong' | 'green' | 'yellow' | 'gray' | 'light-gray'; priority: number }
> = {
  INSUFFICIENT_DATA: { tone: 'light-gray', priority: 1 },
  NO_ENTRY: { tone: 'gray', priority: 2 },
  BUY_STRONG: { tone: 'green-strong', priority: 3 },
  BUY_NOW: { tone: 'green', priority: 4 },
  WAIT_FOR_BREAKOUT: { tone: 'yellow', priority: 5 },
  WAIT_FOR_PULLBACK: { tone: 'yellow', priority: 6 },
  WAIT_FOR_CONFIRMATION: { tone: 'yellow', priority: 7 },
};

// SRS f07 — Warning badge enum (4 risk flags, contribute to confidence penalty).
export const WARNING_BADGES = [
  'HIGH_DEBT',
  'NEGATIVE_OCF',
  'LEGAL_RISK',
  'HIGH_INVENTORY',
] as const;
export type WarningBadge = (typeof WARNING_BADGES)[number];

// SRS f01 — Excluded round (4 filters before scoring).
export type ExcludedRound = 1 | 2 | 3 | 4;

export const EXCLUDED_REASONS = [
  'HIGH_DE',
  'LEGAL_BLOCK',
  'PENNY_PRICE',
  'LOW_LIQUIDITY',
  'INSUFFICIENT_DATA',
  'NEWLY_LISTED',
] as const;
export type ExcludedReasonCode = (typeof EXCLUDED_REASONS)[number];

// Mock outcome toggle for UX testing (cluster prompt §7.2).
export const MOCK_RUN_OUTCOMES = ['success', 'warnings', 'failed', 'conflict'] as const;
export type MockRunOutcome = (typeof MOCK_RUN_OUTCOMES)[number];

export const MOCK_RUN_OUTCOME_KEY = 'mock_run_outcome';

// LocalStorage keys
export const STORAGE_KEYS = {
  token: 'token',
  theme: 'theme',
  locale: 'locale',
} as const;

// Mock JWT prefix (c08 §2 + cluster prompt §7)
export const MOCK_JWT_PREFIX = 'mock-jwt-';
