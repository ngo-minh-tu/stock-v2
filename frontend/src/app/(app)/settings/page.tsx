'use client';

// Cluster 6 §6 — full Settings page with 6 collapsible sections.

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { LanguagePicker } from '@/components/settings/LanguagePicker';
import { MockOutcomePicker } from '@/components/settings/MockOutcomePicker';
import { NewsSourcesToggles } from '@/components/settings/NewsSourcesToggles';
import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm';
import { ShareLinksManagement } from '@/components/settings/ShareLinksManagement';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { ThresholdSliders } from '@/components/settings/ThresholdSliders';
import { TelegramSettings } from '@/components/telegram/TelegramSettings';
import { useSettingsFull } from '@/lib/hooks/useSettingsFull';

export default function SettingsPage() {
  const tSettings = useTranslations('settings');
  const tSection = useTranslations('settings.section');
  const settings = useSettingsFull();

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <header>
        <h1 className="text-2xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {tSettings('title')}
        </h1>
        {settings.data && (
          <p className="text-2xs mt-1" style={{ color: 'var(--color-theme-text-secondary)' }}>
            settings_version: v{settings.data.settings_version}
          </p>
        )}
      </header>

      {settings.loading && !settings.data && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          {tSettings('loading')}
        </div>
      )}

      {settings.error && !settings.data && (
        <div className="card p-4 text-sm" style={{ borderColor: 'var(--ssi-down)' }}>
          {tSettings('errorLoad')}
        </div>
      )}

      {settings.data && (
        <>
          <CollapsibleSection
            id="appearance"
            title={tSection('appearance')}
            description={tSettings('theme.description')}
          >
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
                  {tSettings('theme.label')}
                </h3>
                <ThemePicker layout="cards" />
              </div>
              <div>
                <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
                  {tSettings('language.label')}
                </h3>
                <LanguagePicker layout="list" />
              </div>
              <div>
                <h3 className="text-xs font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
                  {tSettings('mockOutcome.label')}
                </h3>
                <p className="text-2xs mb-2" style={{ color: 'var(--color-theme-text-secondary)' }}>
                  {tSettings('mockOutcome.description')}
                </p>
                <MockOutcomePicker />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="threshold"
            title={tSection('threshold')}
            description={tSettings('threshold.description')}
            defaultOpen={false}
          >
            <ThresholdSliders data={settings.data} saving={settings.saving} onSave={settings.save} />
          </CollapsibleSection>

          <CollapsibleSection
            id="sources"
            title={tSection('sources')}
            description={tSettings('sources.description')}
            defaultOpen={false}
          >
            <NewsSourcesToggles data={settings.data} saving={settings.saving} onSave={settings.save} />
          </CollapsibleSection>

          <CollapsibleSection
            id="telegram"
            title={tSection('telegram')}
            description={tSettings('telegram.description')}
            defaultOpen={false}
          >
            <TelegramSettings data={settings.data} saving={settings.saving} onSave={settings.save} />
          </CollapsibleSection>

          <CollapsibleSection
            id="security"
            title={tSection('security')}
            description={tSettings('password.description')}
            defaultOpen={false}
          >
            <PasswordChangeForm />
          </CollapsibleSection>

          <CollapsibleSection
            id="share"
            title={tSection('share')}
            description={tSettings('share.description')}
            defaultOpen={false}
          >
            <ShareLinksManagement />
          </CollapsibleSection>
        </>
      )}
    </div>
  );
}
