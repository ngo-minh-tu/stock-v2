'use client';

import { useTranslations } from 'next-intl';

import { ComingSoon } from '@/components/common/ComingSoon';

export default function PortfolioPage() {
  const t = useTranslations('nav');
  return <ComingSoon title={t('portfolio')} clusterNumber={5} />;
}
