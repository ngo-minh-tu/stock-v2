'use client';

import { Construction } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ComingSoonProps {
  title: string;
  clusterNumber: 2 | 3 | 4 | 5 | 6;
}

export function ComingSoon({ title, clusterNumber }: ComingSoonProps) {
  const t = useTranslations('common.comingSoon');
  return (
    <section className="flex flex-col items-center justify-center text-center py-24 gap-4">
      <h1 className="text-2xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
        {title}
      </h1>
      <Construction
        size={48}
        aria-hidden="true"
        style={{ color: 'var(--color-theme-crimson)' }}
      />
      <p className="text-base max-w-md">{t('body', { cluster: clusterNumber })}</p>
      <p
        className="text-xs"
        style={{ color: 'var(--color-theme-text-secondary)' }}
      >
        {t('title')}
      </p>
    </section>
  );
}
