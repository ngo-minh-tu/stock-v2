'use client';

import { useTranslations } from 'next-intl';

import { ComingSoon } from '@/components/common/ComingSoon';

export default function PriceBoardPage() {
  const t = useTranslations('nav');
  return <ComingSoon title={t('priceBoard')} clusterNumber={4} />;
}
