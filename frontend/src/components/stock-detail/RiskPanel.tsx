'use client';

// 3 sub-cards horizontal: stop loss · allocation · confidence breakdown.

import { useTranslations } from 'next-intl';

import type { StockDetailResponse } from '@/lib/types';

import { AllocationCard } from './AllocationCard';
import { ConfidenceCard } from './ConfidenceCard';
import { StopLossCard } from './StopLossCard';

interface Props {
  detail: StockDetailResponse;
  totalCapital: number;
}

export function RiskPanel({ detail, totalCapital }: Props) {
  const t = useTranslations('stockDetail.risk');
  const isInsufficient = detail.entry.signal === 'INSUFFICIENT_DATA';

  if (isInsufficient) {
    return (
      <section className="card p-4 flex flex-col gap-2">
        <header>
          <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('title')}
          </h2>
        </header>
        <p className="text-xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('insufficientNote')}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('title')}
        </h2>
        <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('subtitle')}
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StopLossCard
          stopLossPrice={detail.risk.stop_loss_price}
          currentPrice={detail.static.current_price}
          hasBuyPrice={detail.risk.has_buy_price}
        />
        <AllocationCard
          allocationAmount={detail.risk.allocation_amount}
          allocationWeight={detail.risk.allocation_weight}
          totalCapital={totalCapital}
        />
        <ConfidenceCard
          confidenceRaw={detail.scoring.confidence_raw}
          confidencePenalty={detail.scoring.confidence_penalty}
          confidenceFinal={detail.scoring.confidence}
          badges={detail.risk.warning_badges}
        />
      </div>
    </section>
  );
}
