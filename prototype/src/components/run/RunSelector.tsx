'use client';

import { useTranslations } from 'next-intl';

import type { RunSummary } from '@/lib/types';

interface Props {
  runs: RunSummary[];
  selectedRunId: string;
  onSelect: (runId: string) => void;
}

function formatRunLabel(r: RunSummary): string {
  const d = new Date(r.run_at);
  const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time} — ${r.scored_count} mã`;
}

export function RunSelector({ runs, selectedRunId, onSelect }: Props) {
  const t = useTranslations('dashboard.runSelector');
  return (
    <label className="flex items-center gap-2 text-xs">
      <span style={{ color: 'var(--color-theme-text-secondary)' }}>{t('label')}:</span>
      <select
        className="input-control"
        style={{ minWidth: 220, fontSize: 12, height: 32, padding: '0.25rem 0.5rem' }}
        value={selectedRunId}
        onChange={(e) => onSelect(e.target.value)}
      >
        {runs.map((r) => (
          <option key={r.run_id} value={r.run_id}>
            {formatRunLabel(r)}
          </option>
        ))}
      </select>
    </label>
  );
}
