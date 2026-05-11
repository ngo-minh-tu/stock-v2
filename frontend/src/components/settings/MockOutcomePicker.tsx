'use client';

import { useTranslations } from 'next-intl';

import { useMockOutcome } from '@/contexts/MockOutcomeContext';
import { MOCK_RUN_OUTCOMES, type MockRunOutcome } from '@/lib/constants';

export function MockOutcomePicker() {
  const t = useTranslations('settings.mockOutcome');
  const tOpts = useTranslations('settings.mockOutcome.options');
  const { outcome, setOutcome } = useMockOutcome();

  return (
    <div className="flex flex-wrap gap-2">
      {MOCK_RUN_OUTCOMES.map((opt) => {
        const active = opt === outcome;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => setOutcome(opt as MockRunOutcome)}
            className="btn btn-ghost text-2xs px-3 py-1"
            style={{
              backgroundColor: active ? 'var(--color-theme-tertiary)' : undefined,
              borderColor: active ? 'var(--color-theme-crimson)' : undefined,
              color: active ? 'var(--color-theme-text-tertiary)' : undefined,
            }}
            aria-pressed={active}
          >
            {tOpts(opt)}
          </button>
        );
      })}
      <span
        className="text-2xs self-center ml-2"
        style={{ color: 'var(--color-theme-text-secondary)' }}
      >
        {t('hint')}
      </span>
    </div>
  );
}
