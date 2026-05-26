'use client';

import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

// Replacement for Recharts' `ResponsiveContainer` — under Next 16 + webpack
// dev/prod, Recharts 2.13's container fails to commit its initial size via
// useEffect, leaving the chart stuck at {-1, -1} and rendering nothing.
// This wrapper measures the parent ourselves and forwards width/height
// numerically to the child chart (Recharts top-level charts accept both).
export function ResponsiveChart({
  children,
}: {
  children: ReactElement<{ width?: number; height?: number }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      {size.width > 0 && size.height > 0 && isValidElement(children)
        ? cloneElement(children, { width: size.width, height: size.height })
        : null}
    </div>
  );
}
