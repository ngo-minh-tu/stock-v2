'use client';

import { useTranslations } from 'next-intl';

import { useTheme } from '@/contexts/ThemeContext';
import { THEME_KEYS, type ThemeKey } from '@/lib/constants';

const PREVIEW: Record<ThemeKey, { surface: string; accent: string; text: string }> = {
  'classic-dark': { surface: '#1c1a29', accent: '#d32f2f', text: '#ffffff' },
  'classic-light': { surface: '#ffffff', accent: '#d32f2f', text: '#1e2329' },
  light: { surface: '#ffffff', accent: '#d32f2f', text: '#1e2329' },
  oled: { surface: '#000000', accent: '#d32f2f', text: '#ffffff' },
};

interface ThemePickerProps {
  layout?: 'cards' | 'menu';
}

export function ThemePicker({ layout = 'cards' }: ThemePickerProps) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('settings.theme.options');

  if (layout === 'menu') {
    return (
      <div role="radiogroup" aria-label="Theme">
        {THEME_KEYS.map((key) => (
          <button
            key={key}
            role="radio"
            aria-checked={theme === key}
            onClick={() => setTheme(key)}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-left"
            style={{
              backgroundColor:
                theme === key ? 'var(--color-theme-dropdown-active)' : 'transparent',
              color: 'var(--color-theme-text-tertiary)',
            }}
          >
            <span
              aria-hidden="true"
              className="inline-block w-5 h-5 rounded-sm border"
              style={{
                backgroundColor: PREVIEW[key].surface,
                borderColor: 'var(--color-theme-charcoal)',
              }}
            />
            <span className="flex-1">{t(key)}</span>
            {theme === key && (
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--color-theme-crimson)' }}
              />
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="grid gap-3 grid-cols-2 md:grid-cols-4">
      {THEME_KEYS.map((key) => {
        const checked = theme === key;
        const swatch = PREVIEW[key];
        return (
          <button
            key={key}
            role="radio"
            aria-checked={checked}
            onClick={() => setTheme(key)}
            className="card p-3 text-left flex flex-col gap-3 transition-colors"
            style={{
              borderColor: checked ? 'var(--color-theme-crimson)' : 'var(--color-theme-charcoal)',
              borderWidth: checked ? '2px' : '1px',
            }}
          >
            <div
              aria-hidden="true"
              className="aspect-[16/9] rounded-sm flex flex-col p-2 gap-1"
              style={{ backgroundColor: swatch.surface, color: swatch.text }}
            >
              <span className="text-3xs">Aa</span>
              <span
                className="self-start text-3xs px-1 py-0.5 rounded-sm"
                style={{ backgroundColor: swatch.accent, color: '#ffffff' }}
              >
                CTA
              </span>
              <div className="mt-auto flex gap-1">
                <span
                  className="block w-3 h-1.5 rounded-sm"
                  style={{ backgroundColor: '#1aa67c' }}
                />
                <span
                  className="block w-3 h-1.5 rounded-sm"
                  style={{ backgroundColor: '#c9111f' }}
                />
              </div>
            </div>
            <span className="text-sm font-medium">{t(key)}</span>
          </button>
        );
      })}
    </div>
  );
}
