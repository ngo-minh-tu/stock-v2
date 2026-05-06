'use client';

import { useTranslations } from 'next-intl';

import { ComingSoon } from '@/components/common/ComingSoon';

export default function DashboardPage() {
  const t = useTranslations('nav');
  return <ComingSoon title={t('dashboard')} clusterNumber={2} />;
}
