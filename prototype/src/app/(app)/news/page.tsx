'use client';

import { useTranslations } from 'next-intl';

import { ComingSoon } from '@/components/common/ComingSoon';

export default function NewsPage() {
  const t = useTranslations('nav');
  return <ComingSoon title={t('news')} clusterNumber={4} />;
}
