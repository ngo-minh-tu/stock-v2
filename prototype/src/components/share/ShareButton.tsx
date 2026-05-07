'use client';

// Cluster 6 §4.1 — "Chia sẻ" trigger. Opens ShareLinkModal which creates the link.

import { Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ShareLinkModal } from './ShareLinkModal';

interface Props {
  runId: string | null;
  disabled?: boolean;
}

export function ShareButton({ runId, disabled }: Props) {
  const t = useTranslations('share');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen(true)}
        disabled={disabled || !runId}
      >
        <Share2 size={14} aria-hidden="true" />
        {t('button')}
      </button>
      <ShareLinkModal
        open={open}
        runId={runId}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
