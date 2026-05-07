'use client';

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ExternalLink, GitCompareArrows, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { RunStatus } from '@/lib/constants';
import type { RunSummary } from '@/lib/types';

interface Props {
  rows: RunSummary[];
  selectedA: string | null;
  selectedB: string | null;
  onView: (run_id: string) => void;
  onCompareToggle: (run_id: string) => void;
  onDelete: (row: RunSummary) => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function relativeTime(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'vừa xong';
  if (diffMin < 60) return `${diffMin}p trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h trước`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} ngày trước`;
}

function statusColor(s: RunStatus): string {
  if (s === 'COMPLETED') return 'var(--ssi-up)';
  if (s === 'COMPLETED_WITH_WARNINGS') return 'var(--ssi-stable)';
  if (s === 'FAILED') return 'var(--ssi-down)';
  return 'var(--color-theme-text-secondary)';
}

function MiniBars({ buy, hold, sell }: { buy: number; hold: number; sell: number }) {
  const total = Math.max(1, buy + hold + sell);
  const buyPct = (buy / total) * 100;
  const holdPct = (hold / total) * 100;
  const sellPct = (sell / total) * 100;
  return (
    <div className="flex items-center gap-1 min-w-[80px]" title={`${buy} / ${hold} / ${sell}`}>
      <div className="flex-1 flex h-2 rounded overflow-hidden">
        <div style={{ width: `${buyPct}%`, backgroundColor: 'var(--ssi-up)' }} />
        <div style={{ width: `${holdPct}%`, backgroundColor: 'var(--ssi-ref)' }} />
        <div style={{ width: `${sellPct}%`, backgroundColor: 'var(--ssi-down)' }} />
      </div>
      <span className="text-3xs tabular-nums whitespace-nowrap">
        {buy}/{hold}/{sell}
      </span>
    </div>
  );
}

function truncateRunId(id: string): string {
  // run_seed_3 → run_seed_3 (already short); run_1714999999999 → run_…9999
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatVnd(amount: number): string {
  return amount.toLocaleString('fr-FR');
}

export function RunHistoryTable({
  rows,
  selectedA,
  selectedB,
  onView,
  onCompareToggle,
  onDelete,
}: Props) {
  const t = useTranslations('runHistory.column');
  const tStatus = useTranslations('run.status');
  const tAction = useTranslations('runHistory.action');

  // Default sort: run_at DESC.
  const [sorting, setSorting] = useState<SortingState>([{ id: 'run_at', desc: true }]);

  const columns = useMemo<ColumnDef<RunSummary>[]>(
    () => [
      {
        id: 'run_id',
        accessorKey: 'run_id',
        header: () => t('runId'),
        cell: ({ row }) => {
          const id = row.original.run_id;
          const selA = selectedA === id;
          const selB = selectedB === id;
          return (
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-2xs" title={id}>
                {truncateRunId(id)}
              </span>
              {selA && (
                <span
                  className="text-3xs px-1 rounded"
                  style={{ backgroundColor: 'var(--ssi-up)', color: '#000' }}
                >
                  A
                </span>
              )}
              {selB && (
                <span
                  className="text-3xs px-1 rounded"
                  style={{ backgroundColor: 'var(--ssi-info, #009bde)', color: '#fff' }}
                >
                  B
                </span>
              )}
            </span>
          );
        },
      },
      {
        id: 'run_at',
        accessorKey: 'run_at',
        header: () => t('runAt'),
        cell: ({ row }) => (
          <span title={row.original.run_at} className="text-2xs">
            {relativeTime(row.original.run_at)}
          </span>
        ),
        sortingFn: (a, b) => {
          return new Date(a.original.run_at).getTime() - new Date(b.original.run_at).getTime();
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: () => t('status'),
        cell: ({ row }) => (
          <span
            className="text-3xs px-1.5 py-0.5 rounded font-medium uppercase whitespace-nowrap"
            style={{ color: statusColor(row.original.status), border: '1px solid currentColor' }}
          >
            {tStatus(row.original.status)}
          </span>
        ),
      },
      {
        id: 'model_version',
        accessorKey: 'model_version',
        header: () => t('modelVersion'),
        cell: ({ row }) => (
          <span className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {row.original.model_version}
          </span>
        ),
      },
      {
        id: 'settings_version',
        accessorKey: 'settings_version',
        header: () => t('settingsVersion'),
        cell: ({ row }) => <span className="text-2xs">v{row.original.settings_version}</span>,
      },
      {
        id: 'scored_count',
        accessorKey: 'scored_count',
        header: () => t('scoredCount'),
        cell: ({ row }) => (
          <span className="tabular-nums text-2xs">{row.original.scored_count}</span>
        ),
      },
      {
        id: 'breakdown',
        header: () => t('breakdown'),
        cell: ({ row }) => (
          <MiniBars
            buy={row.original.buy_count}
            hold={row.original.hold_count}
            sell={row.original.sell_count}
          />
        ),
      },
      {
        id: 'total_capital',
        accessorKey: 'total_capital',
        header: () => t('totalCapital'),
        cell: ({ row }) =>
          row.original.total_capital > 0 ? (
            <span className="tabular-nums text-2xs">{formatVnd(row.original.total_capital)}</span>
          ) : (
            <span className="opacity-30">—</span>
          ),
      },
      {
        id: 'duration',
        accessorKey: 'duration_seconds',
        header: () => t('duration'),
        cell: ({ row }) => (
          <span className="tabular-nums text-2xs">{formatDuration(row.original.duration_seconds)}</span>
        ),
      },
      {
        id: 'warnings',
        accessorKey: 'warnings_count',
        header: () => t('warnings'),
        cell: ({ row }) => {
          const c = row.original.warnings_count;
          if (c === 0) return <span className="opacity-30">—</span>;
          return (
            <span
              className="text-3xs font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--ssi-stable)', color: '#1e2329' }}
            >
              {c}
            </span>
          );
        },
      },
      {
        id: 'action',
        header: () => t('action'),
        cell: ({ row }) => {
          const id = row.original.run_id;
          const inCompare = selectedA === id || selectedB === id;
          return (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1 opacity-70 hover:opacity-100"
                aria-label={tAction('view')}
                title={tAction('view')}
                onClick={() => onView(id)}
              >
                <ExternalLink size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="p-1 opacity-70 hover:opacity-100"
                aria-label={tAction('compare')}
                title={tAction('compare')}
                onClick={() => onCompareToggle(id)}
                style={{ color: inCompare ? 'var(--ssi-up)' : undefined }}
              >
                <GitCompareArrows size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="p-1 opacity-70 hover:opacity-100"
                aria-label={tAction('delete')}
                title={tAction('delete')}
                onClick={() => onDelete(row.original)}
                style={{ color: 'var(--ssi-down)' }}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          );
        },
      },
    ],
    [t, tStatus, tAction, selectedA, selectedB, onView, onCompareToggle, onDelete],
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
                  className="px-2 py-2 select-none cursor-pointer whitespace-nowrap font-medium text-left"
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
                <td key={cell.id} className="px-2 py-1.5 align-middle whitespace-nowrap">
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
