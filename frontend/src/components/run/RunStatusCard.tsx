'use client';

// Floating progress card sticky just below the header (z above content, below modal/toast).
// Auto-dismiss handled by RunContext. We render nothing if there is no active run.

import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { RUN_TERMINAL_STATES } from '@/lib/constants';
import { useRun } from '@/contexts/RunContext';

export function RunStatusCard() {
  const tStatus = useTranslations('run.status');
  const tCard = useTranslations('run.card');
  const { activeRunId, status, dismiss } = useRun();

  if (!activeRunId) return null;

  // Polling hasn't returned yet — show a gentle initializing state instead of empty.
  const progress = status?.progress_percent ?? 5;
  const currentStatus = status?.status ?? 'PENDING';
  const isTerminal = status ? RUN_TERMINAL_STATES.has(status.status) : false;
  const isFailed = status?.status === 'FAILED';

  return (
    <div
      className="sticky top-14 z-40 mx-4 mt-3 rounded-md border p-3 flex items-center gap-3 shadow-md"
      style={{
        backgroundColor: 'var(--color-theme-card-bg)',
        borderColor: isFailed ? 'var(--ssi-down)' : 'var(--color-theme-charcoal)',
      }}
      role="status"
      aria-live="polite"
    >
      {isTerminal ? (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{
            backgroundColor: isFailed ? 'var(--ssi-down)' : 'var(--ssi-up)',
            color: isFailed ? '#ffffff' : '#000000',
          }}
        >
          {tStatus(currentStatus)}
        </span>
      ) : (
        <Loader2 size={16} aria-hidden="true" className="animate-spin shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium truncate">
            {status?.current_step ?? tCard('initializing')}
          </span>
          <span
            className="text-2xs ml-auto shrink-0"
            style={{ color: 'var(--color-theme-text-secondary)' }}
          >
            {progress}%
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 rounded overflow-hidden"
          style={{ backgroundColor: 'var(--color-theme-tertiary)' }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: isFailed ? 'var(--ssi-down)' : 'var(--ssi-up)',
            }}
          />
        </div>
        {status && status.warnings.length > 0 && (
          <div
            className="mt-1.5 text-2xs flex items-center gap-1"
            style={{ color: '#f49f3b' }}
          >
            <AlertTriangle size={10} aria-hidden="true" />
            {tCard('warningsCount', { count: status.warnings.length })}
          </div>
        )}
      </div>

      {/* Cancel disabled per TAD MVP rule */}
      <button
        type="button"
        className="btn btn-ghost text-2xs px-2 py-1"
        disabled
        title={tCard('cancelDisabled')}
      >
        {tCard('cancel')}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={tCard('close')}
        className="opacity-60 hover:opacity-100 shrink-0"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
