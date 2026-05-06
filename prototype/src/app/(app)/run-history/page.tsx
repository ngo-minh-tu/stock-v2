'use client';

import { useTranslations } from 'next-intl';

import { ComingSoon } from '@/components/common/ComingSoon';

export default function RunHistoryPage() {
  const t = useTranslations('nav');
  return <ComingSoon title={t('runHistory')} clusterNumber={5} />;
}
