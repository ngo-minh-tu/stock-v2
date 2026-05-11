'use client';

// Cluster 6 §6.1 — Settings sections are collapsible cards. Open/close state persists
// in localStorage (key: `settings.section.{id}`) so F5 keeps the layout (AC §10.11).

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
  id: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const STORAGE_PREFIX = 'settings.section.';

function readPersisted(id: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(STORAGE_PREFIX + id);
  if (v === '1') return true;
  if (v === '0') return false;
  return fallback;
}

export function CollapsibleSection({ id, title, description, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // Hydrate from localStorage post-mount to keep SSR/CSR markup identical.
  useEffect(() => {
    setOpen(readPersisted(id, defaultOpen));
  }, [id, defaultOpen]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_PREFIX + id, next ? '1' : '0');
      }
      return next;
    });
  };

  return (
    <section className="card flex flex-col">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center justify-between gap-3 px-6 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {title}
          </h2>
          {description && (
            <p className="text-2xs mt-0.5" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
        {open ? (
          <ChevronDown size={16} aria-hidden="true" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="px-6 pb-6 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--color-theme-charcoal)' }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </section>
  );
}
