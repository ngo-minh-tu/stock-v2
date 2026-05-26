'use client';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { DeleteHoldingModal } from '@/components/portfolio/DeleteHoldingModal';
import { HoldingFormModal } from '@/components/portfolio/HoldingFormModal';
import { PortfolioKPI } from '@/components/portfolio/PortfolioKPI';
import { PortfolioTable, type HoldingRow } from '@/components/portfolio/PortfolioTable';
import { useToast } from '@/contexts/ToastContext';
import { useApiResource } from '@/lib/hooks/useApiResource';
import { usePortfolio } from '@/lib/hooks/usePortfolio';
import type { PortfolioHolding, StocksListResponse } from '@/lib/types';

export default function PortfolioPage() {
  const t = useTranslations('portfolio');
  const tNav = useTranslations('nav');
  const { push } = useToast();

  const portfolio = usePortfolio();
  // Cluster 4 latest-price snapshot (anchored to runs-store.latest internally) — used to compute
  // current_price / TTCK colors. limit=200 to fetch all 81 stocks in one go.
  const stocksRes = useApiResource<StocksListResponse>('/api/stocks?limit=200');

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PortfolioHolding | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HoldingRow | null>(null);

  // Build computed rows joining holdings × latest price snapshot.
  const rows: HoldingRow[] = useMemo(() => {
    const holdings = portfolio.list.data?.items ?? [];
    const stocks = stocksRes.data?.items ?? [];
    const stockMap = new Map(stocks.map((s) => [s.ticker, s]));

    return holdings.map((h) => {
      const stock = stockMap.get(h.ticker);
      // BE returns `latest: LatestPrice | null` (Phase 25 schema rename — sync với
      // BE truth `StockListItem.latest`). Null khi ticker chưa có price snapshot
      // → fall through to buy_price.
      const current_price = stock?.latest?.close ?? h.buy_price;
      const ceiling = stock?.latest?.ceiling ?? current_price * 1.07;
      const floor = stock?.latest?.floor ?? current_price * 0.93;
      const reference = stock?.latest?.reference ?? current_price;
      // Convert ngàn đồng → VND for cost / value (×1000).
      const cost_basis = Math.round(h.quantity * h.buy_price * 1000);
      const market_value = Math.round(h.quantity * current_price * 1000);
      const pnl = market_value - cost_basis;
      const pnl_pct = cost_basis > 0 ? (pnl / cost_basis) * 100 : 0;
      return {
        ...h,
        name: stock?.name ?? h.ticker,
        current_price,
        market_value,
        cost_basis,
        pnl,
        pnl_pct,
        ceiling,
        floor,
        reference,
      };
    });
  }, [portfolio.list.data, stocksRes.data]);

  const totals = useMemo(() => {
    const totalCost = rows.reduce((s, r) => s + r.cost_basis, 0);
    const currentValue = rows.reduce((s, r) => s + r.market_value, 0);
    const totalPnl = currentValue - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    return { totalCost, currentValue, totalPnl, totalPnlPct };
  }, [rows]);

  const handleAdd = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const handleEdit = (row: HoldingRow) => {
    setEditTarget(row);
    setFormOpen(true);
  };

  const handleDelete = (row: HoldingRow) => {
    setDeleteTarget(row);
  };

  const handleSubmit = async (input: Parameters<typeof portfolio.add>[0]) => {
    if (editTarget) {
      await portfolio.update(editTarget.id, input);
      push({ kind: 'success', title: t('toast.editSuccess.title'), message: t('toast.editSuccess.body', { ticker: input.ticker }) });
    } else {
      await portfolio.add(input);
      push({ kind: 'success', title: t('toast.addSuccess.title'), message: t('toast.addSuccess.body', { ticker: input.ticker }) });
    }
    setFormOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const ticker = deleteTarget.ticker;
    await portfolio.remove(deleteTarget.id);
    push({ kind: 'success', title: t('toast.deleteSuccess.title'), message: t('toast.deleteSuccess.body', { ticker }) });
    setDeleteTarget(null);
  };

  const loading = portfolio.list.loading || stocksRes.loading;
  const empty = !loading && rows.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {tNav('portfolio')}
          </h1>
          <p className="text-2xs" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('subtitle')}
          </p>
        </div>
        {!empty && (
          <button type="button" className="btn btn-primary" onClick={handleAdd}>
            <Plus size={14} aria-hidden="true" />
            {t('addButton')}
          </button>
        )}
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          {t('loading')}
        </div>
      )}

      {!loading && portfolio.list.error && (
        <div className="card p-4 text-sm" style={{ borderColor: 'var(--ssi-down)' }}>
          {t('errorLoad')}
        </div>
      )}

      {!loading && empty && (
        <div className="card p-8 flex flex-col items-center justify-center text-center gap-3">
          <h2 className="text-md font-medium" style={{ color: 'var(--color-theme-text-tertiary)' }}>
            {t('empty.title')}
          </h2>
          <p className="text-2xs max-w-sm" style={{ color: 'var(--color-theme-text-secondary)' }}>
            {t('empty.hint')}
          </p>
          <button type="button" className="btn btn-primary mt-2" onClick={handleAdd}>
            <Plus size={14} aria-hidden="true" />
            {t('empty.action')}
          </button>
        </div>
      )}

      {!loading && !empty && (
        <>
          <PortfolioKPI
            totalCost={totals.totalCost}
            currentValue={totals.currentValue}
            totalPnl={totals.totalPnl}
            totalPnlPct={totals.totalPnlPct}
            holdingCount={rows.length}
          />
          <PortfolioTable rows={rows} onEdit={handleEdit} onDelete={handleDelete} />
        </>
      )}

      <HoldingFormModal
        open={formOpen}
        initial={editTarget}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <DeleteHoldingModal
        open={deleteTarget !== null}
        ticker={deleteTarget?.ticker ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
