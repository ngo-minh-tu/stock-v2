'use client';

// Dev-only toggle for the next run's mock outcome (cluster prompt §7.2).
// Persisted to localStorage so toggling in Settings survives a page reload.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { MOCK_RUN_OUTCOME_KEY, MOCK_RUN_OUTCOMES, type MockRunOutcome } from '@/lib/constants';

interface MockOutcomeContextValue {
  outcome: MockRunOutcome;
  setOutcome: (next: MockRunOutcome) => void;
}

const MockOutcomeContext = createContext<MockOutcomeContextValue | null>(null);

export function MockOutcomeProvider({ children }: { children: React.ReactNode }) {
  const [outcome, setOutcomeState] = useState<MockRunOutcome>('success');

  useEffect(() => {
    const stored = window.localStorage.getItem(MOCK_RUN_OUTCOME_KEY);
    if (stored && (MOCK_RUN_OUTCOMES as readonly string[]).includes(stored)) {
      setOutcomeState(stored as MockRunOutcome);
    }
  }, []);

  const setOutcome = useCallback((next: MockRunOutcome) => {
    setOutcomeState(next);
    window.localStorage.setItem(MOCK_RUN_OUTCOME_KEY, next);
  }, []);

  const value = useMemo(() => ({ outcome, setOutcome }), [outcome, setOutcome]);
  return <MockOutcomeContext.Provider value={value}>{children}</MockOutcomeContext.Provider>;
}

export function useMockOutcome(): MockOutcomeContextValue {
  const ctx = useContext(MockOutcomeContext);
  if (!ctx) throw new Error('useMockOutcome must be used within MockOutcomeProvider');
  return ctx;
}
