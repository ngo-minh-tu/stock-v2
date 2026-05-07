'use client';

import { useTranslations } from 'next-intl';

import { EXCHANGES, type Exchange } from '@/lib/constants';

export interface PriceBoardFilterState {
  exchanges: Set<Exchange>;
  sector: string | 'ALL';
  newlyListedOnly: boolean;
}

interface Props {
  state: PriceBoardFilterState;
  sectors: string[];
  onChange: (next: PriceBoardFilterState) => void;
  /** Reset to default (all exchanges, all sectors, newly_listed off). */
  onReset: () => void;
}

const EXCHANGE_BORDER: Record<Exchange, string> = {
  HOSE: 'var(--ssi-up)',
  HNX: 'var(--ssi-floor)',
  UPCOM: 'var(--ssi-ref)',
};

export function PriceBoardFilters({ state, sectors, onChange, onReset }: Props) {
  const t = useTranslations('priceBoard.filter');

  const toggleExchange = (ex: Exchange) => {
    const next = new Set(state.exchanges);
    if (next.has(ex)) next.delete(ex);
    else next.add(ex);
    onChange({ ...state, exchanges: next });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <div className="text-2xs mb-1" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('exchange')}
        </div>
        <div className="flex gap-1">
          {EXCHANGES.map((ex) => {
            const active = state.exchanges.has(ex);
            return (
              <button
                key={ex}
                type="button"
                onClick={() => toggleExchange(ex)}
                className="px-2 py-1 rounded text-2xs border transition-opacity"
                aria-pressed={active}
                style={{
                  color: active ? '#fff' : EXCHANGE_BORDER[ex],
                  borderColor: EXCHANGE_BORDER[ex],
                  backgroundColor: active ? EXCHANGE_BORDER[ex] : 'transparent',
                  opacity: active ? 1 : 0.85,
                }}
              >
                {ex}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-2xs mb-1 block" style={{ color: 'var(--color-theme-text-secondary)' }}>
          {t('sector')}
        </label>
        <select
          className="input-control"
          style={{ minWidth: '180px' }}
          value={state.sector}
          onChange={(e) => onChange({ ...state, sector: e.target.value as PriceBoardFilterState['sector'] })}
        >
          <option value="ALL">{t('sectorAll')}</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-2xs cursor-pointer">
        <input
          type="checkbox"
          checked={state.newlyListedOnly}
          onChange={(e) => onChange({ ...state, newlyListedOnly: e.target.checked })}
        />
        {t('newlyListedOnly')}
      </label>

      <button type="button" className="btn btn-ghost text-2xs px-2 py-1" onClick={onReset}>
        {t('reset')}
      </button>
    </div>
  );
}
