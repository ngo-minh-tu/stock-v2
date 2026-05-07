'use client';

// HOSE / HNX / UPCOM tag — purely informational, theme-aware via CSS vars.

interface Props {
  value: 'HOSE' | 'HNX' | 'UPCOM';
}

const COLOR: Record<Props['value'], string> = {
  HOSE: 'var(--ssi-up)',
  HNX: 'var(--ssi-floor)',
  UPCOM: 'var(--ssi-ref)',
};

export function ExchangeBadge({ value }: Props) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium border"
      style={{
        color: COLOR[value],
        borderColor: COLOR[value],
        backgroundColor: 'transparent',
      }}
    >
      {value}
    </span>
  );
}
