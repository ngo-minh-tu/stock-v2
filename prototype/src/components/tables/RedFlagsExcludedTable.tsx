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

import { EXCLUDED_REASONS, type ExcludedReasonCode, type ExcludedRound } from '@/lib/constants';
import type { ExcludedStock } from '@/lib/types';

interface Props {
  excluded: ExcludedStock[];
}

export function RedFlagsExcludedTable({ excluded }: Props) {
  const t = useTranslations('redFlags');
  const tCol = useTranslations('redFlags.column');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'excluded_round', desc: false }]);
  const [round, setRound] = useState<'all' | ExcludedRound>('all');
  const [reason, setReason] = useState<'all' | ExcludedReasonCode>('all');

  const filtered = useMemo(() => {
    return excluded.filter((e) => {
      if (round !== 'all' && e.excluded_round !== round) return false;
      if (reason !== 'all' && e.reason_code !== reason) return false;
      return true;
    });
  }, [excluded, round, reason]);

  const columns = useMemo<ColumnDef<ExcludedStock>[]>(
    () => [
      { accessorKey: 'ticker', header: () => tCol('ticker'), cell: (info) => <span className="font-bold">{info.getValue() as string}</span> },
      { accessorKey: 'name', header: () => tCol('name') },
      { accessorKey: 'excluded_round', header: () => tCol('round'), cell: (info) => `Vòng ${info.getValue()}` },
      { accessorKey: 'reason_code', header: () => tCol('reasonCode') },
      { accessorKey: 'reason_text', header: () => tCol('reasonText') },
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

  if (excluded.length === 0) {
    return (
      <div className="card p-6 text-sm text-center">
        <p>{t('section.excluded.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('filter.round')}:</span>
          <select
            className="input-control"
            style={{ width: 120, height: 32, fontSize: 12 }}
            value={round}
            onChange={(e) => setRound(e.target.value === 'all' ? 'all' : (Number(e.target.value) as ExcludedRound))}
          >
            <option value="all">{t('filter.all')}</option>
            {[1, 2, 3, 4].map((r) => (
              <option key={r} value={r}>Vòng {r}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('filter.reason')}:</span>
          <select
            className="input-control"
            style={{ width: 180, height: 32, fontSize: 12 }}
            value={reason}
            onChange={(e) => setReason(e.target.value as 'all' | ExcludedReasonCode)}
          >
            <option value="all">{t('filter.all')}</option>
            {EXCLUDED_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <span className="text-2xs ml-auto" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('section.excluded.count', { n: filtered.length, total: excluded.length })}
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
