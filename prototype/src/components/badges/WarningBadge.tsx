'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { WarningBadge as WarningBadgeCode } from '@/lib/constants';

interface Props {
  value: WarningBadgeCode;
  size?: 'sm' | 'md';
}

export function WarningBadge({ value, size = 'md' }: Props) {
  const t = useTranslations('warning');
  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-2xs gap-1' : 'px-2 py-1 text-xs gap-1.5';
  return (
    <span
      className={`inline-flex items-center rounded font-medium border ${padding}`}
      style={{
        backgroundColor: 'rgba(244, 159, 59, 0.15)',
        color: '#f49f3b',
        borderColor: '#f49f3b',
      }}
    >
      <AlertTriangle size={size === 'sm' ? 10 : 12} aria-hidden="true" />
      {t(value)}
    </span>
  );
}
