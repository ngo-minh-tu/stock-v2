'use client';

import { Construction } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { LanguagePicker } from '@/components/settings/LanguagePicker';
import { MockOutcomePicker } from '@/components/settings/MockOutcomePicker';
import { ThemePicker } from '@/components/settings/ThemePicker';

export default function SettingsPage() {
  const tSettings = useTranslations('settings');

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <header>
        <h1 className="text-2xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {tSettings('title')}
        </h1>
      </header>

      <section className="card p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {tSettings('theme.label')}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {tSettings('theme.description')}
          </p>
        </div>
        <ThemePicker layout="cards" />
      </section>

      <section className="card p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {tSettings('language.label')}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {tSettings('language.description')}
          </p>
        </div>
        <LanguagePicker layout="list" />
      </section>

      <section className="card p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {tSettings('mockOutcome.label')}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {tSettings('mockOutcome.description')}
          </p>
        </div>
        <MockOutcomePicker />
      </section>

      <section
        className="card p-6 flex items-start gap-3"
        style={{ borderStyle: 'dashed' }}
      >
        <Construction
          size={20}
          aria-hidden="true"
          style={{ color: 'var(--color-theme-crimson)' }}
        />
        <div>
          <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {tSettings('comingSoon.title')}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {tSettings('comingSoon.body')}
          </p>
        </div>
      </section>
    </div>
  );
}
