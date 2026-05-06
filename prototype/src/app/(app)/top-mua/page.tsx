'use client';

import { useTranslations } from 'next-intl';

import { ComingSoon } from '@/components/common/ComingSoon';

export default function TopMuaPage() {
  const t = useTranslations('nav');
  return <ComingSoon title={t('topMua')} clusterNumber={2} />;
}
