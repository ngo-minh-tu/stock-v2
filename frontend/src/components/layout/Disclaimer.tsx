'use client';

import { useTranslations } from 'next-intl';

export function Disclaimer() {
  const t = useTranslations('common');
  return (
    <footer
      className="border-t px-6 py-4"
      style={{
        backgroundColor: 'var(--color-theme-secondary)',
        borderColor: 'var(--color-theme-charcoal)',
      }}
      role="contentinfo"
    >
      <p className="text-xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {t('disclaimer')}
      </p>
    </footer>
  );
}
