'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import {
  PriceBoardFilters,
  type PriceBoardFilterState,
} from '@/components/price-board/PriceBoardFilters';
import { InfoBanner } from '@/components/common/InfoBanner';
import { PriceBoardTable } from '@/components/price-board/PriceBoardTable';
import { useStocks } from '@/lib/hooks/useStocks';
import type { LatestPrice, StockListItem } from '@/lib/types';
import { EXCHANGES } from '@/lib/constants';

// Phase 25: Narrow row type — page filter ensures `latest !== null` for all rows
// passed to PriceBoardTable, matching its `PriceBoardRow` prop constraint.
type RowWithPrice = StockListItem & { latest: LatestPrice };

const DEFAULT_FILTER: PriceBoardFilterState = {
  exchanges: new Set(EXCHANGES),
  sector: 'ALL',
  newlyListedOnly: false,
};

export default function PriceBoardPage() {
  const t = useTranslations('priceBoard');
  const tNav = useTranslations('nav');
  const [filter, setFilter] = useState<PriceBoardFilterState>({
    ...DEFAULT_FILTER,
    exchanges: new Set(EXCHANGES),
  });

  // limit=100 is enough for the 81-ticker fixture; cluster prompt §3.4 says default = 1 page.
  const { data, error, loading } = useStocks(100, 0);

  const sectors = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>(data.items.map((i) => i.sector));
    return [...set].sort();
  }, [data]);

  const filteredRows = useMemo<RowWithPrice[]>(() => {
    if (!data) return [];
    return data.items.filter((row): row is RowWithPrice => {
      // Phase 25 schema rename: BE serves `latest: LatestPrice | null`. Hide
      // ticker chưa có price snapshot — TTCK board hiển thị row trống sẽ gây
      // hiểu lầm (giá 0 không phải floor).
      if (!row.latest) return false;
      if (!filter.exchanges.has(row.exchange)) return false;
      if (filter.sector !== 'ALL' && row.sector !== filter.sector) return false;
      if (filter.newlyListedOnly && !row.newly_listed) return false;
      return true;
    });
  }, [data, filter]);

  // Phase 27 — count ticker bị ẩn vì null-latest để hiển thị placeholder
  // ("Còn N mã chưa có dữ liệu giá — chạy /refresh/all để cập nhật").
  // Tránh trader hiểu lầm "thiếu mã trên TTCK board".
  const missingPriceCount = useMemo(() => {
    if (!data) return 0;
    return data.items.reduce(
      (n, row) => (row.latest === null ? n + 1 : n),
      0,
    );
  }, [data]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {tNav('priceBoard')}
        </h1>
        {data && (
          <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('subtitle', { count: data.total })}
          </p>
        )}
      </header>

      {loading && !data && (
        <div
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--color-theme-text-secondary)' }}
        >
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          {t('loading')}
        </div>
      )}

      {error && (
        <div className="card p-4 text-sm" style={{ color: 'var(--ssi-down)' }}>
          {t('errorLoad')}
        </div>
      )}

      {data && (
        <>
          <PriceBoardFilters
            state={filter}
            sectors={sectors}
            onChange={setFilter}
            onReset={() => setFilter({ ...DEFAULT_FILTER, exchanges: new Set(EXCHANGES) })}
          />
          {missingPriceCount > 0 && (
            <InfoBanner
              testId="price-board-missing-data"
              storageKey="price-board-missing-data-v1"
              text={t('missingData', { count: missingPriceCount })}
            />
          )}
          <PriceBoardTable
            rows={filteredRows}
            searchPlaceholder={t('search.placeholder')}
            emptyTitle={t('empty.title')}
            emptyHint={t('empty.hint')}
            newlyBadge={t('newlyBadge')}
            perfNote={(count) => t('perfNote', { count })}
          />
        </>
      )}
    </div>
  );
}
