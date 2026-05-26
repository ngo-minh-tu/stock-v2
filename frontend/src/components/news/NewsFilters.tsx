'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { SourceLogo } from '@/components/common/SourceLogo';
import {
  NEWS_DATE_RANGES,
  NEWS_SOURCES,
  SENTIMENT_LABELS,
  type NewsDateRange,
  type NewsSourceKey,
  type SentimentLabelKey,
} from '@/lib/constants';

import { SENTIMENT_BORDER_TINT } from './SentimentChip';

export interface NewsFilterState {
  sources: Set<NewsSourceKey>;
  sentiments: Set<SentimentLabelKey>;
  ticker: string | null;
  dateRange: NewsDateRange;
  mockFailure: NewsSourceKey | null;
}

interface Props {
  state: NewsFilterState;
  tickerOptions: { ticker: string; name: string }[];
  onChange: (next: NewsFilterState) => void;
  onReset: () => void;
}

export function NewsFilters({ state, tickerOptions, onChange, onReset }: Props) {
  const t = useTranslations('news.filter');
  const tSource = useTranslations('news.source');
  const tSent = useTranslations('news.sentiment');
  const tDate = useTranslations('news.dateRange');

  const toggleSource = (s: NewsSourceKey) => {
    const next = new Set(state.sources);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange({ ...state, sources: next });
  };

  const setSentimentRadio = (val: SentimentLabelKey | 'ALL') => {
    if (val === 'ALL') onChange({ ...state, sentiments: new Set() });
    else onChange({ ...state, sentiments: new Set([val]) });
  };

  const sentimentRadioValue: SentimentLabelKey | 'ALL' =
    state.sentiments.size === 1 ? [...state.sentiments][0] : 'ALL';

  return (
    <aside className="flex flex-col gap-4 text-2xs">
      {/* Source — multi-select checkboxes */}
      <section>
        <h3 className="font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('source')}
        </h3>
        <div className="flex flex-col gap-1">
          {NEWS_SOURCES.map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.sources.has(s)}
                onChange={() => toggleSource(s)}
              />
              <SourceLogo source={s} size="sm" />
              {tSource(s)}
            </label>
          ))}
        </div>
      </section>

      {/* Sentiment — single-select radio (ALL + 3 enums) */}
      <section>
        <h3 className="font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('sentiment')}
        </h3>
        <div className="flex flex-col gap-1">
          {(['ALL', ...SENTIMENT_LABELS] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="news-sentiment"
                checked={sentimentRadioValue === opt}
                onChange={() => setSentimentRadio(opt)}
              />
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    opt === 'ALL'
                      ? 'var(--color-theme-text-secondary)'
                      : SENTIMENT_BORDER_TINT[opt],
                }}
                aria-hidden="true"
              />
              {opt === 'ALL' ? tSent('all') : tSent(opt)}
            </label>
          ))}
        </div>
      </section>

      {/* Ticker — autocomplete via datalist (cheap, no extra dep) */}
      <section>
        <h3 className="font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('ticker')}
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            list="news-ticker-list"
            className="input-control"
            placeholder={t('tickerPlaceholder')}
            value={state.ticker ?? ''}
            onChange={(e) => onChange({ ...state, ticker: e.target.value.toUpperCase() || null })}
          />
          {state.ticker && (
            <button
              type="button"
              onClick={() => onChange({ ...state, ticker: null })}
              className="opacity-70 hover:opacity-100"
              aria-label={t('tickerClear')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <datalist id="news-ticker-list">
          {tickerOptions.map((s) => (
            <option key={s.ticker} value={s.ticker}>
              {s.name}
            </option>
          ))}
        </datalist>
      </section>

      {/* Date range — single-select radio */}
      <section>
        <h3 className="font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('dateRange')}
        </h3>
        <div className="flex flex-col gap-1">
          {NEWS_DATE_RANGES.map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="news-daterange"
                checked={state.dateRange === r}
                onChange={() => onChange({ ...state, dateRange: r })}
              />
              {tDate(r)}
            </label>
          ))}
        </div>
      </section>

      {/* Mock failure (dev only) */}
      <section>
        <h3 className="font-medium mb-2" style={{ color: 'var(--color-theme-text-tertiary)' }}>
          {t('mockFailure')}
        </h3>
        <select
          className="input-control"
          value={state.mockFailure ?? ''}
          onChange={(e) =>
            onChange({
              ...state,
              mockFailure: (e.target.value || null) as NewsSourceKey | null,
            })
          }
        >
          <option value="">— off —</option>
          {NEWS_SOURCES.map((s) => (
            <option key={s} value={s}>
              {tSource(s)}
            </option>
          ))}
        </select>
      </section>

      <button type="button" className="btn btn-ghost text-2xs" onClick={onReset}>
        {t('reset')}
      </button>
    </aside>
  );
}
