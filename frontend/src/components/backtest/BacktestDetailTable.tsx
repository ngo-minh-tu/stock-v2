'use client';

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Check, X as XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { RecommendationBadge } from '@/components/badges/RecommendationBadge';
import type { BacktestResultRow } from '@/lib/types';

interface Props {
  rows: BacktestResultRow[];
}

export function BacktestDetailTable({ rows }: Props) {
  const t = useTranslations('backtest.detail.column');

  // Default sort: error % DESC (largest mistakes first — most informative).
  const [sorting, setSorting] = useState<SortingState>([{ id: 'error', desc: true }]);

  const columns = useMemo<ColumnDef<BacktestResultRow>[]>(
    () => [
      {
        id: 'ticker',
        accessorKey: 'ticker',
        header: () => t('ticker'),
        cell: ({ row }) => (
          <span className="font-bold">{row.original.ticker}</span>
        ),
      },
      {
        id: 'predicted_recommendation',
        accessorKey: 'predicted_recommendation',
        header: () => t('predicted'),
        cell: ({ row }) => <RecommendationBadge value={row.original.predicted_recommendation} size="sm" />,
      },
      {
        id: 'actual_return',
        accessorKey: 'actual_return_3m',
        header: () => t('actualReturn'),
        cell: ({ row }) => {
          const v = row.original.actual_return_3m;
          const color = v > 0 ? 'var(--ssi-up)' : v < 0 ? 'var(--ssi-down)' : 'var(--ssi-stable)';
          return (
            <span className="tabular-nums" style={{ color }}>
              {v > 0 ? '+' : ''}{v.toFixed(2)}%
            </span>
          );
        },
      },
      {
        id: 'predicted_price',
        accessorKey: 'predicted_price',
        header: () => t('predictedPrice'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.predicted_price.toFixed(2)}</span>,
      },
      {
        id: 'actual_price',
        accessorKey: 'actual_price',
        header: () => t('actualPrice'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.actual_price.toFixed(2)}</span>,
      },
      {
        id: 'error',
        accessorKey: 'price_error_pct',
        header: () => t('error'),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.price_error_pct.toFixed(2)}%</span>
        ),
      },
      {
        id: 'correct',
        accessorKey: 'recommendation_correct',
        header: () => t('correct'),
        cell: ({ row }) =>
          row.original.recommendation_correct ? (
            <Check size={14} aria-hidden="true" style={{ color: 'var(--ssi-up)' }} />
          ) : (
            <XIcon size={14} aria-hidden="true" style={{ color: 'var(--ssi-down)' }} />
          ),
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div
      className="card overflow-x-auto"
      style={{ backgroundColor: 'var(--color-theme-table-row-even)' }}
    >
      <table className="w-full text-2xs">
        <thead
          style={{
            backgroundColor: 'var(--color-theme-table-header)',
            borderBottom: '1px solid var(--color-theme-table-border)',
          }}
        >
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="px-2 py-2 text-left select-none cursor-pointer whitespace-nowrap font-medium"
                  style={{ color: 'var(--color-theme-text-tertiary)' }}
                >
                  <span className="inline-flex items-center gap-1">
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
                backgroundColor:
                  row.index % 2 === 0
                    ? 'var(--color-theme-table-row-even)'
                    : 'var(--color-theme-table-row-odd)',
                borderBottom: '1px solid var(--color-theme-table-border)',
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-2 py-1.5">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
