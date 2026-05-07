'use client';

import { ChevronDown, LogOut, Menu, Palette } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { RunButton } from '@/components/run/RunButton';
import { LanguagePicker } from '@/components/settings/LanguagePicker';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const tBrand = useTranslations('app.brand');
  const tHeader = useTranslations('header');
  const tThemeOptions = useTranslations('settings.theme.options');

  const { logout } = useAuth();
  const { theme } = useTheme();

  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement | null>(null);

  // Close theme dropdown on outside-click / Escape.
  useEffect(() => {
    if (!themeOpen) return;
    function onClick(event: MouseEvent) {
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setThemeOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [themeOpen]);

  return (
    <header
      className="sticky top-0 z-50 h-14 px-4 flex items-center gap-3 border-b"
      style={{
        backgroundColor: 'var(--color-theme-secondary)',
        borderColor: 'var(--color-theme-charcoal)',
      }}
    >
      <button
        type="button"
        className="md:hidden btn btn-ghost p-2"
        onClick={onMenuToggle}
        aria-label="Toggle navigation"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      <div className="flex flex-col leading-tight min-w-0">
        <span
          className="text-sm font-bold truncate"
          style={{ color: 'var(--color-theme-text-tertiary)' }}
        >
          {tBrand('name')}
        </span>
        <span
          className="text-2xs truncate hidden sm:block"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          {tBrand('tagline')}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <RunButton />

        <div className="relative" ref={themeRef}>
          <button
            type="button"
            className="btn btn-ghost"
            aria-haspopup="listbox"
            aria-expanded={themeOpen}
            aria-label={tHeader('themeAria')}
            onClick={() => setThemeOpen((value) => !value)}
          >
            <Palette size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{tThemeOptions(theme)}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {themeOpen && (
            <div
              role="listbox"
              className="absolute right-0 mt-2 w-56 rounded-md border shadow-md p-1"
              style={{
                backgroundColor: 'var(--color-theme-dropdown-background)',
                borderColor: 'var(--color-theme-charcoal)',
              }}
            >
              <ThemePicker layout="menu" />
            </div>
          )}
        </div>

        <LanguagePicker layout="segmented" />

        <button
          type="button"
          className="btn btn-ghost p-2"
          onClick={logout}
          aria-label={tHeader('logout')}
          title={tHeader('logout')}
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
