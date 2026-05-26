'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/lib/api';
import type { PortfolioCreateRequest, PortfolioHolding } from '@/lib/types';
import { STOCK_FIXTURE } from '@/mocks/data/stocks-fixture';

interface Props {
  open: boolean;
  initial: PortfolioHolding | null; // null = add mode, present = edit mode
  onClose: () => void;
  onSubmit: (input: PortfolioCreateRequest) => Promise<void>;
}

// Phase 25 (carry Phase 19 REVIEW Low): runtime TODAY thay cho hard-code
// `'2026-05-07'`. Tránh form expire khi clock vượt qua fixture anchor.
function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HoldingFormModal({ open, initial, onClose, onSubmit }: Props) {
  const t = useTranslations('portfolio.modal');
  const isEdit = initial !== null;

  // `today` resolved once mỗi lần modal mount, stable trong vòng đời open.
  const TODAY = useMemo(() => getTodayIso(), []);

  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState(TODAY);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Populate / reset on open.
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTicker(initial.ticker);
      setQuantity(String(initial.quantity));
      setBuyPrice(String(initial.buy_price));
      setBuyDate(initial.buy_date);
      setNotes(initial.notes ?? '');
    } else {
      setTicker('');
      setQuantity('');
      setBuyPrice('');
      setBuyDate(TODAY);
      setNotes('');
    }
    setError(null);
    setSubmitting(false);
  }, [open, initial, TODAY]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Ticker autocomplete suggestions (max 8) — typing-as-you-go.
  const suggestions = useMemo(() => {
    const q = ticker.trim().toUpperCase();
    if (!q) return [] as { ticker: string; name: string }[];
    return STOCK_FIXTURE.filter(
      (s) => s.ticker.startsWith(q) || s.name.toUpperCase().includes(q),
    )
      .slice(0, 8)
      .map((s) => ({ ticker: s.ticker, name: s.name }));
  }, [ticker]);

  if (!open) return null;

  const validateClient = (): string | null => {
    const upper = ticker.trim().toUpperCase();
    if (!upper) return t('error.tickerRequired');
    if (!STOCK_FIXTURE.some((s) => s.ticker === upper)) return t('error.tickerNotInList');
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) return t('error.quantityInvalid');
    const p = Number(buyPrice);
    if (!Number.isFinite(p) || p <= 0) return t('error.priceInvalid');
    if (!buyDate) return t('error.dateRequired');
    if (buyDate > TODAY) return t('error.dateFuture');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const localErr = validateClient();
    if (localErr) {
      setError(localErr);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        ticker: ticker.trim().toUpperCase(),
        quantity: Number(quantity),
        buy_price: Number(buyPrice),
        buy_date: buyDate,
        notes: notes.trim() || null,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('error.serverError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-theme-overlay)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-md border p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--color-theme-secondary)',
          borderColor: 'var(--color-theme-charcoal)',
        }}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {isEdit ? t('edit.title') : t('add.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 opacity-70 hover:opacity-100"
            aria-label={t('close')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('field.ticker')}</span>
          <input
            type="text"
            className="input-control"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="VHM"
            autoFocus={!isEdit}
            disabled={isEdit}
            list="ticker-suggestions"
          />
          <datalist id="ticker-suggestions">
            {suggestions.map((s) => (
              <option key={s.ticker} value={s.ticker}>
                {s.name}
              </option>
            ))}
          </datalist>
          {!isEdit && suggestions.length > 0 && (
            <span className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
              {suggestions[0].name}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('field.quantity')}</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            className="input-control"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1000"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('field.buyPrice')}</span>
          <div className="flex items-stretch gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              className="input-control flex-1"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="42.00"
            />
            <span
              className="flex items-center px-3 rounded text-xs whitespace-nowrap"
              style={{
                backgroundColor: 'var(--color-theme-tertiary)',
                color: 'var(--color-theme-text-secondary)',
              }}
            >
              {t('field.priceUnit')}
            </span>
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('field.buyDate')}</span>
          <input
            type="date"
            max={TODAY}
            className="input-control"
            value={buyDate}
            onChange={(e) => setBuyDate(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('field.notes')}</span>
          <textarea
            className="input-control"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('field.notesPlaceholder')}
          />
        </label>

        {error && (
          <span style={{ color: 'var(--ssi-down)' }} className="text-xs">
            {error}
          </span>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? t('submitting') : isEdit ? t('save') : t('submitAdd')}
          </button>
        </div>
      </form>
    </div>
  );
}
