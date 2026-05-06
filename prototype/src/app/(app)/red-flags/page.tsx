'use client';

import { useTranslations } from 'next-intl';

import { ComingSoon } from '@/components/common/ComingSoon';

export default function RedFlagsPage() {
  const t = useTranslations('nav');
  return <ComingSoon title={t('redFlags')} clusterNumber={2} />;
}
