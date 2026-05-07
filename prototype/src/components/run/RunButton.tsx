'use client';

import { Loader2, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useMockOutcome } from '@/contexts/MockOutcomeContext';
import { useRun } from '@/contexts/RunContext';

import { CapitalModal } from './CapitalModal';

export function RunButton() {
  const t = useTranslations('run.button');
  const { isRunning, startRun } = useRun();
  const { outcome } = useMockOutcome();
  const [open, setOpen] = useState(false);

  const handleSubmit = async (totalCapital: number) => {
    setOpen(false);
    await startRun({ totalCapital, outcome });
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
        disabled={isRunning}
        aria-label={t('label')}
      >
        {isRunning ? (
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
        ) : (
          <Play size={14} aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{isRunning ? t('running') : t('label')}</span>
      </button>
      <CapitalModal open={open} onClose={() => setOpen(false)} onSubmit={handleSubmit} />
    </>
  );
}
