'use client';

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { PortfolioHolding } from '@/lib/types';

export interface HoldingRow extends PortfolioHolding {
  name: string;
  current_price: number;        // ngàn đồng
  market_value: number;         // VND
  cost_basis: number;           // VND
  pnl: number;                  // VND
  pnl_pct: number;              // %
  ceiling: number;
  floor: number;
  reference: number;
}

interface Props {
  rows: HoldingRow[];
  onEdit: (row: HoldingRow) => void;
  onDelete: (row: HoldingRow) => void;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('fr-FR');
}
function formatDate(yyyymmdd: string): string {
  // dd/MM/yyyy.
  const parts = yyyymmdd.split('-');
  if (parts.length !== 3) return yyyymmdd;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

import { PriceCell } from '@/components/price-board/PriceCell';

export function PortfolioTable({ rows, onEdit, onDelete }: Props) {
  const t = useTranslations('portfolio.column');
  const tAction = useTranslations('portfolio.action');
  const router = useRouter();

  // Default sort: PnL % DESC (cluster prompt §3.2).
  const [sorting, setSorting] = useState<SortingState>([{ id: 'pnl_pct', desc: true }]);

  const columns = useMemo<ColumnDef<HoldingRow>[]>(
    () => [
      {
        id: 'ticker',
        accessorKey: 'ticker',
        header: () => t('ticker'),
        cell: ({ row }) => (
          <button
            type="button"
            className="font-bold underline-offset-2 hover:underline"
            style={{ color: 'var(--color-theme-text-tertiary)' }}
            onClick={() =>
              router.push(`/stock-detail?ticker=${encodeURIComponent(row.original.ticker)}`)
            }
          >
            {row.original.ticker}
          </button>
        ),
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: () => t('name'),
        cell: ({ row }) => (
          <span className="truncate block max-w-[180px]" title={row.original.name}>
            {row.original.name}
          </span>
        ),
      },
      {
        id: 'quantity',
        accessorKey: 'quantity',
        header: () => t('quantity'),
        cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.quantity)}</span>,
      },
      {
        id: 'buy_price',
        accessorKey: 'buy_price',
        header: () => t('buyPrice'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.buy_price.toFixed(2)}</span>,
      },
      {
        id: 'buy_date',
        accessorKey: 'buy_date',
        header: () => t('buyDate'),
        cell: ({ row }) => (
          <span className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {formatDate(row.original.buy_date)}
          </span>
        ),
      },
      {
        id: 'current_price',
        accessorKey: 'current_price',
        header: () => t('currentPrice'),
        cell: ({ row }) => (
          <PriceCell
            mode="dynamic"
            ceiling={row.original.ceiling}
            floor={row.original.floor}
            reference={row.original.reference}
            value={row.original.current_price}
          />
        ),
      },
      {
        id: 'cost_basis',
        accessorKey: 'cost_basis',
        header: () => t('costBasis'),
        cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.cost_basis)}</span>,
      },
      {
        id: 'market_value',
        accessorKey: 'market_value',
        header: () => t('marketValue'),
        cell: ({ row }) => <span className="tabular-nums">{formatVnd(row.original.market_value)}</span>,
      },
      {
        id: 'pnl',
        accessorKey: 'pnl',
        header: () => t('pnl'),
        cell: ({ row }) => {
          const v = row.original.pnl;
          const color = v > 0 ? 'var(--ssi-up)' : v < 0 ? 'var(--ssi-down)' : 'var(--ssi-stable)';
          return (
            <span className="tabular-nums" style={{ color }}>
              {v > 0 ? '+' : ''}{formatVnd(v)}
            </span>
          );
        },
      },
      {
        id: 'pnl_pct',
        accessorKey: 'pnl_pct',
        header: () => t('pnlPct'),
        cell: ({ row }) => {
          const v = row.original.pnl_pct;
          const color = v > 0 ? 'var(--ssi-up)' : v < 0 ? 'var(--ssi-down)' : 'var(--ssi-stable)';
          return (
            <span className="tabular-nums" style={{ color }}>
              {v > 0 ? '+' : ''}{v.toFixed(2)}%
            </span>
          );
        },
      },
      {
        id: 'notes',
        accessorKey: 'notes',
        header: () => t('notes'),
        cell: ({ row }) => {
          const n = row.original.notes;
          if (!n) return <span className="opacity-30">—</span>;
          // Truncated with full text in title.
          return (
            <span
              className="truncate block max-w-[160px] text-2xs"
              title={n}
              style={{ color: 'var(--color-theme-text-secondary)' }}
            >
              {n}
            </span>
          );
        },
      },
      {
        id: 'action',
        header: () => t('action'),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1 opacity-70 hover:opacity-100"
              aria-label={tAction('edit')}
              onClick={() => onEdit(row.original)}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="p-1 opacity-70 hover:opacity-100"
              aria-label={tAction('delete')}
              onClick={() => onDelete(row.original)}
              style={{ color: 'var(--ssi-down)' }}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [t, tAction, router, onEdit, onDelete],
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
      style={{
        backgroundColor: 'var(--color-theme-table-row-even)',
        borderColor: 'var(--color-theme-table-border)',
      }}
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
                  className="px-2 py-2 select-none cursor-pointer whitespace-nowrap font-medium"
                  style={{
                    color: 'var(--color-theme-text-tertiary)',
                    textAlign:
                      h.id === 'ticker' || h.id === 'name' || h.id === 'notes' || h.id === 'action'
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
                <td
                  key={cell.id}
                  className="px-2 py-1.5 align-middle"
                  style={{
                    textAlign:
                      cell.column.id === 'ticker' ||
                      cell.column.id === 'name' ||
                      cell.column.id === 'notes' ||
                      cell.column.id === 'action'
                        ? 'left'
                        : 'right',
                  }}
                >
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
