'use client';

import { useEffect, useState } from 'react';

/**
 * Starts the MSW worker for prototype demos. Children render only after the worker
 * is ready so the very first fetch (e.g. token-check on mount) is intercepted.
 *
 * Phase 9 swap: opt-in only via `NEXT_PUBLIC_ENABLE_MSW=true`. When the env var is
 * absent or any other value, MSW is bypassed and `apiFetch` hits the real backend
 * via `NEXT_PUBLIC_API_BASE_URL`. Default `.env.local` ships MSW=false.
 *
 * Why opt-in even in dev: backend runs on a separate host (`localhost:8000`), so
 * registering MSW would over-aggressively intercept the same-origin paths we now
 * proxy out. Only flip MSW=true when working on the prototype without a backend.
 */
export function MswBootstrap({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_MSW === 'true';
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      // Dynamic imports inside the effect — `msw/browser` blocks Node resolution
      // (its package exports define `"node": null`), so it must never be statically
      // imported anywhere reachable from the server bundle.
      const [{ setupWorker }, { handlers }] = await Promise.all([
        import('msw/browser'),
        import('@/mocks/handlers'),
      ]);
      const worker = setupWorker(...handlers);
      await worker.start({
        onUnhandledRequest: 'bypass',
        quiet: false,
      });
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!ready) return null;
  return <>{children}</>;
}
