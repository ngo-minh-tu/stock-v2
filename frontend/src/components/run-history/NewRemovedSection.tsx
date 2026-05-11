'use client';

import { useTranslations } from 'next-intl';

import { RecommendationBadge } from '@/components/badges/RecommendationBadge';
import type { CompareEntry } from '@/lib/types';

interface Props {
  newEntries: CompareEntry[];
  removed: CompareEntry[];
}

function List({ items, emptyMsg }: { items: CompareEntry[]; emptyMsg: string }) {
  if (items.length === 0) {
    return (
      <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
        {emptyMsg}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1">
      {items.map((e) => (
        <li
          key={e.ticker}
          className="flex items-center justify-between gap-2 py-1"
          style={{ borderBottom: '1px solid var(--color-theme-table-border)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-2xs">{e.ticker}</span>
            <span
              className="text-3xs truncate"
              style={{ color: 'var(--color-theme-text-secondary)' }}
              title={e.name}
            >
              {e.name}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <RecommendationBadge value={e.recommendation} size="sm" />
            <span className="text-2xs tabular-nums">{e.score}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function NewRemovedSection({ newEntries, removed }: Props) {
  const t = useTranslations('runHistory.compare');
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card p-3 flex flex-col gap-2">
        <h4 className="text-2xs font-medium" style={{ color: 'var(--ssi-up)' }}>
          {t('newEntries.title', { count: newEntries.length })}
        </h4>
        <List items={newEntries} emptyMsg={t('newEntries.empty')} />
      </div>
      <div className="card p-3 flex flex-col gap-2">
        <h4 className="text-2xs font-medium" style={{ color: 'var(--ssi-down)' }}>
          {t('removed.title', { count: removed.length })}
        </h4>
        <List items={removed} emptyMsg={t('removed.empty')} />
      </div>
    </div>
  );
}
