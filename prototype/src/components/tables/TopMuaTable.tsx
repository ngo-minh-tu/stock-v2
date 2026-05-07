'use client';

import {
  type ColumnDef,
  type ExpandedState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight, ExternalLink, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Fragment, useMemo, useState } from 'react';

import { EntrySignalChip } from '@/components/badges/EntrySignalChip';
import { RecommendationBadge } from '@/components/badges/RecommendationBadge';
import { WarningBadge } from '@/components/badges/WarningBadge';
import type { ScreeningResult } from '@/lib/types';

interface Props {
  results: ScreeningResult[];
  runId: string;
  /** Cluster 6 §4.3 — public Shared View hides the expander + "Xem chi tiết" link. */
  readOnly?: boolean;
}

function formatVnd(amount: number | undefined): string {
  if (typeof amount !== 'number') return '—';
  return amount.toLocaleString('fr-FR') + ' VND';
}

function ExpandRow({ row, runId }: { row: ScreeningResult; runId: string }) {
  const t = useTranslations('topMua.expand');
  const router = useRouter();
  return (
    <div
      className="px-4 py-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"
      style={{ backgroundColor: 'var(--color-theme-tertiary)' }}
    >
      <div>
        <div className="font-medium mb-1" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('reasons')}
        </div>
        <ul className="list-disc list-inside space-y-0.5">
          {row.reasons.map((r, i) => (
            <li key={i}>
              {r.text}{' '}
              <span style={{ color: 'var(--color-theme-text-secondary)' }}>({r.feature_id})</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="font-medium mb-1" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('riskAndAllocation')}
        </div>
        <ul className="space-y-1">
          <li>
            {t('buyPrice')}:{' '}
            <span style={{ color: 'var(--ssi-up)' }}>{row.buy_price?.toFixed(2)}k</span>
          </li>
          <li>
            {t('stopLoss')}:{' '}
            <span style={{ color: 'var(--ssi-down)' }}>{row.stop_loss_price?.toFixed(2)}k</span>
          </li>
          <li>
            {t('allocation')}: {formatVnd(row.allocation_amount)}
            {row.allocation_weight !== undefined && (
              <span style={{ color: 'var(--color-theme-text-secondary)' }}>
                {' '}
                ({(row.allocation_weight * 100).toFixed(1)}%)
              </span>
            )}
          </li>
          <li>
            {t('confidence')}: {row.confidence_raw}
            {row.confidence_penalty > 0 && (
              <>
                {' '}
                − {row.confidence_penalty} ={' '}
                <span style={{ color: 'var(--color-theme-text-tertiary)' }}>{row.confidence}</span>
              </>
            )}
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        {row.warning_badges.length > 0 ? (
          <>
            <div
              className="font-medium"
              style={{ color: 'var(--color-theme-text-tertiary)' }}
            >
              {t('warnings')}
            </div>
            <div className="flex flex-wrap gap-1">
              {row.warning_badges.map((b) => (
                <WarningBadge key={b} value={b} size="sm" />
              ))}
            </div>
          </>
        ) : (
          <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('noWarnings')}</span>
        )}
        <div className="mt-auto">
          <button
            type="button"
            className="btn btn-ghost text-2xs px-2 py-1"
            onClick={() =>
              router.push(
                `/stock-detail?run_id=${encodeURIComponent(runId)}&ticker=${encodeURIComponent(row.ticker)}`,
              )
            }
          >
            <ExternalLink size={12} aria-hidden="true" />
            {t('viewDetail')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TopMuaTable({ results, runId, readOnly = false }: Props) {
  const t = useTranslations('topMua');
  const tCol = useTranslations('topMua.column');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'ai_score', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const buys = useMemo(
    () => results.filter((r) => r.recommendation === 'MUA'),
    [results],
  );

  const columns = useMemo<ColumnDef<ScreeningResult>[]>(
    () => [
      ...(readOnly
        ? []
        : [
            {
              id: 'expander',
              header: () => null,
              cell: ({ row }: { row: { getIsExpanded: () => boolean; toggleExpanded: () => void } }) => (
                <button
                  type="button"
                  onClick={() => row.toggleExpanded()}
                  aria-label={row.getIsExpanded() ? 'Thu gọn' : 'Mở rộng'}
                  className="opacity-70 hover:opacity-100"
                >
                  {row.getIsExpanded() ? (
                    <ChevronDown size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} aria-hidden="true" />
                  )}
                </button>
              ),
              size: 32,
            } as ColumnDef<ScreeningResult>,
          ]),
      {
        accessorKey: 'ticker',
        header: () => tCol('ticker'),
        cell: ({ row }) =>
          readOnly ? (
            <span className="font-bold">{row.original.ticker}</span>
          ) : (
            <button
              type="button"
              className="font-bold underline-offset-2 hover:underline"
              onClick={() => row.toggleExpanded()}
            >
              {row.original.ticker}
            </button>
          ),
      },
      {
        accessorKey: 'name',
        header: () => tCol('name'),
        cell: ({ row }) => (
          <span className="truncate block max-w-[180px]" title={row.original.name}>
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'ai_score',
        header: () => tCol('aiScore'),
        cell: ({ row }) => <span className="font-medium">{row.original.ai_score}</span>,
      },
      {
        accessorKey: 'recommendation',
        header: () => tCol('recommendation'),
        cell: ({ row }) => <RecommendationBadge value={row.original.recommendation} size="sm" />,
      },
      {
        accessorKey: 'confidence',
        header: () => tCol('confidence'),
        cell: ({ row }) => `${row.original.confidence}%`,
      },
      {
        accessorKey: 'upside_pct',
        header: () => tCol('upside'),
        cell: ({ row }) => {
          const u = row.original.upside_pct;
          const color = u > 0 ? 'var(--ssi-up)' : u < 0 ? 'var(--ssi-down)' : 'var(--ssi-stable)';
          return <span style={{ color }}>{u > 0 ? '+' : ''}{u.toFixed(1)}%</span>;
        },
      },
      {
        accessorKey: 'entry_signal',
        header: () => tCol('entry'),
        cell: ({ row }) => <EntrySignalChip value={row.original.entry_signal} />,
      },
      {
        id: 'warnings',
        header: () => tCol('warnings'),
        cell: ({ row }) =>
          row.original.warning_badges.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.original.warning_badges.map((b) => (
                <WarningBadge key={b} value={b} size="sm" />
              ))}
            </div>
          ) : (
            <span className="opacity-50">—</span>
          ),
      },
    ],
    [tCol, readOnly],
  );

  const table = useReactTable({
    data: buys,
    columns,
    state: { sorting, expanded, globalFilter },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowCanExpand: () => true,
    globalFilterFn: (row, _columnId, value) => {
      const v = String(value).toUpperCase();
      return row.original.ticker.toUpperCase().includes(v) || row.original.name.toUpperCase().includes(v);
    },
  });

  if (buys.length === 0) {
    return (
      <div className="card p-6 text-center text-sm">
        <p>{t('empty.title')}</p>
        <p className="text-2xs mt-1" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('empty.hint')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 max-w-xs">
        <Search size={14} aria-hidden="true" />
        <input
          type="text"
          className="input-control"
          placeholder={t('searchPlaceholder')}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
      </label>

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
              <Fragment key={row.id}>
                <tr
                  className="hover:bg-opacity-50"
                  style={{
                    borderBottom: '1px solid var(--color-theme-table-border)',
                    backgroundColor: row.index % 2 === 0
                      ? 'var(--color-theme-table-row-even)'
                      : 'var(--color-theme-table-row-odd)',
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length}>
                      <ExpandRow row={row.original} runId={runId} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {table.getRowModel().rows.length === 0 && (
        <div className="card p-3 text-center text-2xs">
          {t('noMatch')}
        </div>
      )}
    </div>
  );
}
