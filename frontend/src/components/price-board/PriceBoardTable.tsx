'use client';

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ExchangeBadge } from '@/components/badges/ExchangeBadge';
import { priceColor } from '@/lib/constants';
import type { LatestPrice, StockListItem } from '@/lib/types';

import { PriceCell } from './PriceCell';

// Phase 25: BE `StockListItem.latest` nullable; PriceBoard chỉ render rows đã có
// snapshot (page-level filter `row.latest !== null`). Narrowed prop type lets
// columns access `r.latest` without optional-chain noise.
type PriceBoardRow = StockListItem & { latest: LatestPrice };

interface Props {
  rows: PriceBoardRow[];
  /** Render the search input externally? Default true (lives at top of table). */
  searchPlaceholder: string;
  emptyTitle: string;
  emptyHint: string;
  newlyBadge: string;
  perfNote: (count: number) => string;
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatChange(c: number): string {
  return `${c > 0 ? '+' : ''}${c.toFixed(2)}`;
}
function formatPct(p: number): string {
  return `${p > 0 ? '+' : ''}${p.toFixed(2)}%`;
}

export function PriceBoardTable({
  rows,
  searchPlaceholder,
  emptyTitle,
  emptyHint,
  newlyBadge,
  perfNote,
}: Props) {
  const router = useRouter();
  const tCol = useTranslations('priceBoard.column');

  // Default sort: Close DESC (acceptance #1).
  const [sorting, setSorting] = useState<SortingState>([{ id: 'close', desc: true }]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  // Debounce the ticker search by 200ms per cluster prompt §3.4.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim().toUpperCase()), 200);
    return () => window.clearTimeout(id);
  }, [search]);

  const filtered = useMemo(() => {
    if (!debounced) return rows;
    return rows.filter(
      (r) => r.ticker.toUpperCase().includes(debounced) || r.name.toUpperCase().includes(debounced),
    );
  }, [rows, debounced]);

  const columns = useMemo<ColumnDef<PriceBoardRow>[]>(
    () => [
      {
        id: 'ticker',
        accessorKey: 'ticker',
        header: () => tCol('ticker'),
        cell: ({ row }) => (
          <button
            type="button"
            className="font-bold underline-offset-2 hover:underline"
            style={{ color: 'var(--color-theme-text-tertiary)' }}
            onClick={() => router.push(`/stock-detail?ticker=${encodeURIComponent(row.original.ticker)}`)}
          >
            {row.original.ticker}
          </button>
        ),
      },
      {
        id: 'sector',
        accessorKey: 'sector',
        header: () => tCol('sector'),
        cell: ({ row }) => (
          <span
            className="text-2xs truncate block max-w-[120px]"
            style={{ color: 'var(--color-theme-text-secondary)' }}
            title={row.original.sector}
          >
            {row.original.sector}
          </span>
        ),
      },
      {
        id: 'exchange',
        accessorKey: 'exchange',
        header: () => tCol('exchange'),
        cell: ({ row }) => <ExchangeBadge value={row.original.exchange} />,
      },
      {
        id: 'reference',
        accessorFn: (r) => r.latest.reference,
        header: () => tCol('reference'),
        cell: ({ row }) => (
          <PriceCell mode="static" fixedColor="ref" value={row.original.latest.reference} />
        ),
      },
      {
        id: 'ceiling',
        accessorFn: (r) => r.latest.ceiling,
        header: () => tCol('ceiling'),
        cell: ({ row }) => (
          <PriceCell mode="static" fixedColor="ceil" value={row.original.latest.ceiling} />
        ),
      },
      {
        id: 'floor',
        accessorFn: (r) => r.latest.floor,
        header: () => tCol('floor'),
        cell: ({ row }) => (
          <PriceCell mode="static" fixedColor="floor" value={row.original.latest.floor} />
        ),
      },
      {
        id: 'open',
        accessorFn: (r) => r.latest.open,
        header: () => tCol('open'),
        cell: ({ row }) => (
          <PriceCell mode="static" fixedColor="primary" value={row.original.latest.open} />
        ),
      },
      {
        id: 'high',
        accessorFn: (r) => r.latest.high,
        header: () => tCol('high'),
        cell: ({ row }) => {
          const p = row.original.latest;
          return (
            <PriceCell
              mode="dynamic"
              ceiling={p.ceiling}
              floor={p.floor}
              reference={p.reference}
              value={p.high}
            />
          );
        },
      },
      {
        id: 'low',
        accessorFn: (r) => r.latest.low,
        header: () => tCol('low'),
        cell: ({ row }) => {
          const p = row.original.latest;
          return (
            <PriceCell
              mode="dynamic"
              ceiling={p.ceiling}
              floor={p.floor}
              reference={p.reference}
              value={p.low}
            />
          );
        },
      },
      {
        id: 'close',
        accessorFn: (r) => r.latest.close,
        header: () => tCol('close'),
        cell: ({ row }) => {
          const p = row.original.latest;
          return (
            <span className="font-medium">
              <PriceCell
                mode="dynamic"
                ceiling={p.ceiling}
                floor={p.floor}
                reference={p.reference}
                value={p.close}
              />
            </span>
          );
        },
      },
      {
        id: 'change',
        accessorFn: (r) => r.latest.close - r.latest.reference,
        header: () => tCol('change'),
        cell: ({ row }) => {
          const p = row.original.latest;
          const change = p.close - p.reference;
          return (
            <PriceCell
              mode="dynamic"
              ceiling={p.ceiling}
              floor={p.floor}
              reference={p.reference}
              anchor={p.close}
              value={change}
              format={formatChange}
            />
          );
        },
      },
      {
        id: 'changePct',
        accessorFn: (r) =>
          r.latest.reference === 0
            ? 0
            : ((r.latest.close - r.latest.reference) / r.latest.reference) * 100,
        header: () => tCol('changePct'),
        cell: ({ row }) => {
          const p = row.original.latest;
          const pct = p.reference === 0 ? 0 : ((p.close - p.reference) / p.reference) * 100;
          return (
            <PriceCell
              mode="dynamic"
              ceiling={p.ceiling}
              floor={p.floor}
              reference={p.reference}
              anchor={p.close}
              value={pct}
              format={formatPct}
            />
          );
        },
      },
      {
        id: 'volume',
        accessorFn: (r) => r.latest.volume,
        header: () => tCol('volume'),
        cell: ({ row }) => (
          <span className="tabular-nums" style={{ color: 'var(--color-theme-text-primary)' }}>
            {formatVolume(row.original.latest.volume)}
          </span>
        ),
      },
      {
        id: 'newly',
        accessorFn: (r) => (r.newly_listed ? 1 : 0),
        header: () => tCol('newly'),
        cell: ({ row }) =>
          row.original.newly_listed ? (
            <span
              className="inline-flex px-1.5 py-0.5 rounded text-3xs font-medium"
              style={{
                color: 'var(--color-theme-text-dark)',
                backgroundColor: 'var(--ssi-ref)',
              }}
            >
              {newlyBadge}
            </span>
          ) : (
            <span className="opacity-30">—</span>
          ),
      },
    ],
    [tCol, router, newlyBadge],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 max-w-xs flex-1 min-w-[200px]">
          <Search size={14} aria-hidden="true" />
          <input
            type="text"
            className="input-control"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="text-3xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {perfNote(filtered.length)}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-6 text-center text-sm">
          <p style={{ color: 'var(--color-theme-text-tertiary)' }}>{emptyTitle}</p>
          <p
            className="text-2xs mt-1"
            style={{ color: 'var(--color-theme-text-secondary)' }}
          >
            {emptyHint}
          </p>
        </div>
      ) : (
        <div
          className="card overflow-x-auto"
          style={{
            backgroundColor: 'var(--color-theme-table-row-even)',
            borderColor: 'var(--color-theme-table-border)',
          }}
        >
          <table className="w-full text-2xs" style={{ fontFamily: 'var(--font-roboto), sans-serif' }}>
            <thead
              className="sticky top-0"
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
                      className="px-2 py-2 text-right select-none cursor-pointer whitespace-nowrap font-medium"
                      style={{
                        color: 'var(--color-theme-text-tertiary)',
                        textAlign:
                          h.id === 'ticker' || h.id === 'sector' || h.id === 'exchange' || h.id === 'newly'
                            ? 'left'
                            : 'right',
                      }}
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
              {table.getRowModel().rows.map((row) => {
                const p = row.original.latest;
                // Color test marker — read once per row so the color flag is visible to a11y tools.
                const closeColor = priceColor(p.close, p.ceiling, p.floor, p.reference);
                return (
                  <tr
                    key={row.id}
                    data-color-tag={closeColor}
                    style={{
                      backgroundColor:
                        row.index % 2 === 0
                          ? 'var(--color-theme-table-row-even)'
                          : 'var(--color-theme-table-row-odd)',
                      borderBottom: '1px solid var(--color-theme-table-border)',
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-2 py-1 align-middle"
                        style={{
                          textAlign:
                            cell.column.id === 'ticker' ||
                            cell.column.id === 'sector' ||
                            cell.column.id === 'exchange' ||
                            cell.column.id === 'newly'
                              ? 'left'
                              : 'right',
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
