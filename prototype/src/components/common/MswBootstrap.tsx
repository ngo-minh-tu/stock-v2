'use client';

import { useEffect, useState } from 'react';

/**
 * Starts the MSW worker in development. Children render only after the worker
 * is ready so the very first fetch (e.g. token-check on mount) is intercepted.
 *
 * Production builds short-circuit immediately (no worker, real backend will plug in later).
 */
export function MswBootstrap({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NODE_ENV === 'development';
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
