'use client';

// Phase 25 — informational banner cho fixture/stub surface.
// Phase 28 — add dismissible + LocalStorage persist. Mỗi banner có `storageKey` unique;
// nếu user click X, banner ẩn vĩnh viễn (cho đến khi clear LocalStorage). Banner
// KHÔNG có `storageKey` (legacy callers) sẽ luôn show — backward-compat.

import { Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const LS_PREFIX = 'infobanner-dismissed:';

interface Props {
  text: string;
  testId?: string;
  /**
   * Phase 28 — nếu set, banner có nút "X" dismiss + persist vào LocalStorage
   * dưới key `infobanner-dismissed:{storageKey}`. Mỗi disclaimer unique key
   * (vd "dashboard-disclaimer-v1"). Bump version suffix nếu text thay đổi
   * đáng kể và muốn re-surface cho user đã dismiss.
   */
  storageKey?: string;
}

export function InfoBanner({ text, testId, storageKey }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Hydrate dismiss state from LocalStorage sau mount (SSR-safe).
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = window.localStorage.getItem(LS_PREFIX + storageKey);
      if (stored === '1') setDismissed(true);
    } catch {
      /* SSR / disabled storage — ignore */
    }
  }, [storageKey]);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try {
        window.localStorage.setItem(LS_PREFIX + storageKey, '1');
      } catch {
        /* ignore — banner just won't persist */
      }
    }
  };

  return (
    <div
      role="note"
      data-testid={testId}
      className="card p-3 flex items-start gap-2 text-2xs"
      style={{
        backgroundColor: 'var(--color-theme-secondary)',
        borderColor: 'var(--color-theme-charcoal)',
        color: 'var(--color-theme-text-secondary)',
      }}
    >
      <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <p className="leading-relaxed flex-1">{text}</p>
      {storageKey && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="opacity-60 hover:opacity-100 transition-opacity"
          style={{ flexShrink: 0, marginTop: 1 }}
          data-testid={testId ? `${testId}-dismiss` : undefined}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
