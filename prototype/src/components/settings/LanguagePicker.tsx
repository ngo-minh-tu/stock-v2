'use client';

import { useTranslations } from 'next-intl';

import { useLocale } from '@/contexts/LocaleContext';
import { LOCALES, type Locale } from '@/lib/constants';

interface LanguagePickerProps {
  layout?: 'segmented' | 'list';
}

export function LanguagePicker({ layout = 'list' }: LanguagePickerProps) {
  const { locale, setLocale } = useLocale();
  const t = useTranslations('settings.language.options');

  if (layout === 'segmented') {
    return (
      <div
        role="radiogroup"
        aria-label="Language"
        className="inline-flex rounded-md overflow-hidden border"
        style={{ borderColor: 'var(--color-theme-input-border)' }}
      >
        {LOCALES.map((opt: Locale) => {
          const checked = locale === opt;
          return (
            <button
              key={opt}
              role="radio"
              aria-checked={checked}
              onClick={() => setLocale(opt)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: checked ? 'var(--color-theme-crimson)' : 'transparent',
                color: checked ? '#ffffff' : 'var(--color-theme-text-primary)',
              }}
            >
              {opt === 'vi' ? 'VIE' : 'ENG'}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Language" className="flex flex-col gap-2">
      {LOCALES.map((opt: Locale) => {
        const checked = locale === opt;
        return (
          <label
            key={opt}
            className="card flex items-center gap-3 p-3 cursor-pointer"
            style={{
              borderColor: checked ? 'var(--color-theme-crimson)' : 'var(--color-theme-charcoal)',
              borderWidth: checked ? '2px' : '1px',
            }}
          >
            <input
              type="radio"
              name="locale"
              checked={checked}
              onChange={() => setLocale(opt)}
              aria-label={t(opt)}
            />
            <span className="text-sm">{t(opt)}</span>
          </label>
        );
      })}
    </div>
  );
}
