'use client';

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { RecommendationBadge } from '@/components/badges/RecommendationBadge';
import { WarningBadge } from '@/components/badges/WarningBadge';
import { WARNING_BADGES, type WarningBadge as WarningBadgeCode } from '@/lib/constants';
import type { ScreeningResult } from '@/lib/types';

interface Props {
  results: ScreeningResult[];
}

export function RedFlagsBadgesTable({ results }: Props) {
  const t = useTranslations('redFlags');
  const tCol = useTranslations('redFlags.column');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'confidence_penalty', desc: true }]);
  const [filterBadge, setFilterBadge] = useState<'all' | WarningBadgeCode>('all');

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (r.warning_badges.length === 0) return false;
      if (filterBadge !== 'all' && !r.warning_badges.includes(filterBadge)) return false;
      return true;
    });
  }, [results, filterBadge]);

  const columns = useMemo<ColumnDef<ScreeningResult>[]>(
    () => [
      { accessorKey: 'ticker', header: () => tCol('ticker'), cell: (info) => <span className="font-bold">{info.getValue() as string}</span> },
      { accessorKey: 'ai_score', header: () => tCol('aiScore') },
      {
        accessorKey: 'recommendation',
        header: () => tCol('recommendation'),
        cell: ({ row }) => <RecommendationBadge value={row.original.recommendation} size="sm" />,
      },
      {
        id: 'badges',
        header: () => tCol('badges'),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.warning_badges.map((b) => (
              <WarningBadge key={b} value={b} size="sm" />
            ))}
          </div>
        ),
      },
      {
        accessorKey: 'confidence_penalty',
        header: () => tCol('penalty'),
        cell: ({ row }) => {
          const p = row.original.confidence_penalty;
          return p > 0 ? <span style={{ color: '#f49f3b' }}>−{p}pp</span> : '—';
        },
      },
    ],
    [tCol],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (results.filter((r) => r.warning_badges.length > 0).length === 0) {
    return (
      <div className="card p-6 text-sm text-center">
        <p>{t('section.warnings.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('filter.badge')}:</span>
          <select
            className="input-control"
            style={{ width: 200, height: 32, fontSize: 12 }}
            value={filterBadge}
            onChange={(e) => setFilterBadge(e.target.value as 'all' | WarningBadgeCode)}
          >
            <option value="all">{t('filter.all')}</option>
            {WARNING_BADGES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <span className="text-2xs ml-auto" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('section.warnings.count', { n: filtered.length })}
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead style={{ backgroundColor: 'var(--color-theme-table-header)' }}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="text-left px-3 py-2 cursor-pointer select-none whitespace-nowrap"
                    onClick={h.column.getToggleSortingHandler()}
                    style={{
                      borderBottom: '1px solid var(--color-theme-charcoal)',
                      color: 'var(--color-theme-text-tertiary)',
                    }}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === 'asc' && '↑'}
                      {h.column.getIsSorted() === 'desc' && '↓'}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: '1px solid var(--color-theme-table-border)',
                  backgroundColor: row.index % 2 === 0
                    ? 'var(--color-theme-table-row-even)'
                    : 'var(--color-theme-table-row-odd)',
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
