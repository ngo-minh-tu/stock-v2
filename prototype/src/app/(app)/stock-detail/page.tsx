'use client';

import { useTranslations } from 'next-intl';

import { ComingSoon } from '@/components/common/ComingSoon';

export default function StockDetailPage() {
  const t = useTranslations('nav');
  return <ComingSoon title={t('stockDetail')} clusterNumber={3} />;
}
